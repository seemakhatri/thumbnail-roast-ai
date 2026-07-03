import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createClient } from "../_shared/deps.ts";
// FIXED: was importing analyzeWithFallback/GeminiAnalyzer/GroqAnalyzer from
// vision-analyzer.ts — that file has no niche detection and no niche-aware
// weights, so every thumbnail got scored with one-size-fits-all logic.
// gemini.ts already has the real engine (niche detection, per-niche
// weights, the composition_score fix). Use that instead.
import { analyzeThumbnailStable } from "../_shared/gemini.ts";
import { hashImageUrl } from "../_shared/image-cache.ts";

import type { AnalyzeRequest, ThumbnailAnalysis, ThumbnailReport } from "../_shared/types.ts";

const PLAN_LIMITS: Record<string, number> = {
  guest: 3,
  free: 3,
  creator: 50,
  agency: 99999,
};

// How stale a cache hit can be before we re-run analysis anyway (in case
// your prompt/calibration changes and you want fresher scores over time).
const CACHE_MAX_AGE_DAYS = 30;

function generateSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function isValidStorageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const ref = Deno.env.get("SUPABASE_URL")!.replace("https://", "").split(".")[0];
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === `${ref}.supabase.co` &&
      parsed.pathname.startsWith("/storage/v1/object/public/thumbnails/")
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    let body: AnalyzeRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const { imageUrl } = body;
    if (!imageUrl || typeof imageUrl !== "string") {
      return errorResponse("imageUrl is required", 400);
    }
    if (!isValidStorageUrl(imageUrl)) {
      return errorResponse("imageUrl must be a Supabase Storage URL", 400);
    }

    // ── Authenticate ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.slice(7);
      const tempClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: { user } } = await tempClient.auth.getUser(jwt);
      if (user) userId = user.id;
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── Check Limits (unchanged) ────────────────────────────────────────
    let userPlan = "free";
    if (userId) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("plan, analyses_used, analyses_limit")
        .eq("id", userId)
        .single();

      if (profileError || !profile) return errorResponse("User profile not found", 404);
      userPlan = profile.plan ?? "free";

      const { count } = await supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth());

      const limit = PLAN_LIMITS[profile.plan] ?? 3;
      const used = count ?? 0;

      if (used >= limit) {
        return errorResponse(
          `Monthly limit reached (${used}/${limit}). Please upgrade your plan.`,
          429,
        );
      }
    } else {
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown";

      const { count } = await supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .is("user_id", null)
        .eq("guest_ip", clientIp)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if ((count ?? 0) >= 3) {
        return errorResponse("Guest limit reached (3 analyses per 24h). Sign in for more.", 429);
      }
    }

    // ── Cache check — skip the vision API entirely on a repeat image ─────
    const imageHash = await hashImageUrl(imageUrl);
    const cutoff = new Date(Date.now() - CACHE_MAX_AGE_DAYS * 86400 * 1000).toISOString();

    const { data: cached } = await supabaseAdmin
      .from("reports")
      .select("*")
      .eq("image_hash", imageHash)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      const { user_id: _uid, guest_ip: _ip, ...publicReport } = cached as ThumbnailReport;
      return jsonResponse({ success: true, report: { ...publicReport, was_cached: true } });
    }

    // ── Call the niche-aware analyzer ─────────────────────────────────────
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return errorResponse("No vision provider configured", 500);
    }

    // Paid plans get 3-pass averaging for more stable scores; free/guest
    // get 1 pass to conserve free-tier quota. Tune as you like.
    const passes = userPlan === "creator" || userPlan === "agency" ? 3 : 1;

    let analysis: ThumbnailAnalysis;
    const provider = "gemini";
    try {
      // IMPORTANT: analyzeThumbnailStable already computes overall_score
      // itself, using niche-specific weights (see computeOverallScore in
      // gemini.ts). Do NOT recompute it here — the old code re-derived
      // overall_score with a flat, niche-blind formula that ignored
      // composition_score, color_score, and visual_appeal_score entirely,
      // and weighted face_score at 25% for every niche including ones
      // (art, food, travel) where gemini.ts correctly weights it at 5-8%.
      // That flat recompute is exactly what capped faceless-but-strong
      // thumbnails around 50-69 regardless of real performance.
      analysis = await analyzeThumbnailStable(imageUrl, geminiKey, passes);
    } catch (visionError: unknown) {
      const msg = visionError instanceof Error ? visionError.message : "AI analysis failed";
      console.error("Vision provider error:", msg);
      return errorResponse(`Analysis failed: ${msg}`, 502);
    }

    // ── Save Report ──────────────────────────────────────────────────────
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const reportRecord = {
      user_id: userId ?? null,
      guest_ip: userId ? null : clientIp,
      image_url: imageUrl,
      image_hash: imageHash,
      analyzed_by: provider,
      share_slug: generateSlug(),
      overall_score: analysis.overall_score,
      verdict: analysis.verdict,
      roast_title: analysis.roast_title,
      roast: analysis.roast,
      ctr_score: analysis.metrics.ctr_score,
      readability_score: analysis.metrics.readability_score,
      emotion_score: analysis.metrics.emotion_score,
      curiosity_score: analysis.metrics.curiosity_score,
      mobile_score: analysis.metrics.mobile_score,
      contrast_score: analysis.metrics.contrast_score,
      face_score: analysis.metrics.face_score,
      brand_score: analysis.metrics.brand_score,
      color_score: analysis.metrics.color_score,
      visual_appeal_score: analysis.metrics.visual_appeal_score,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      competitor_insights: analysis.competitor_insights,
      niche: analysis.niche ?? null,
      thumbnail_style: analysis.thumbnail_style ?? null,
      face_present: analysis.face_present ?? false,
      text_present: analysis.text_present ?? false,
      text_count: analysis.text_count ?? 0,
      has_arrow: analysis.has_arrow ?? false,
      has_circle: analysis.has_circle ?? false,
      was_cached: false,
    };

    const { data: savedReport, error: saveError } = await supabaseAdmin
      .from("reports")
      .insert(reportRecord)
      .select()
      .single();

    if (saveError) {
      console.error("DB save error:", saveError);
      return errorResponse(`${saveError.message} | ${saveError.details ?? ""}`, 500);
    }

    if (userId) {
      await supabaseAdmin.rpc("increment_analyses_used", { user_id: userId });
    }

    const { user_id: _uid, guest_ip: _ip, ...publicReport } = savedReport as ThumbnailReport;
    return jsonResponse({ success: true, report: publicReport });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Unhandled error in analyze-thumbnail:", message);
    return errorResponse(message, 500);
  }
});