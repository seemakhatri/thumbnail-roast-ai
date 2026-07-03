import { createClient } from "../_shared/deps.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  compareWithFallback,
  GeminiComparator,
  GroqComparator,
  ThumbnailInput,
  Label,
  CompareVerdict,
} from "../_shared/vision-comparator.ts";
import { FACTOR_LABELS } from "../_shared/niche-battle-weights.ts";
import type { ComparisonRequest } from "../_shared/types.ts";

const REPORT_FIELDS = `
  id, image_url, overall_score, verdict, roast_title, share_slug, created_at, niche,
  ctr_score, readability_score, emotion_score, curiosity_score, mobile_score,
  contrast_score, face_score, brand_score, color_score, visual_appeal_score
`;

interface RecurringPattern {
  factor: string;
  lossRate: number; // 0-1
  sampleSize: number;
  message: string;
}

/**
 * Looks at the user's last N comparison_sessions and tallies which factor
 * they lose on most often. This is what turns Compare from a one-off
 * novelty into a running coaching signal — "you consistently lose on Text
 * Legibility" is more useful than any single A/B result.
 */
async function computeRecurringPattern(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  excludeSessionThumbIds: string[],
): Promise<RecurringPattern | null> {
  const { data: past } = await supabaseAdmin
    .from("comparison_sessions")
    .select("comparison_result, thumbnail_a, thumbnail_b, thumbnail_c, winner_id")
    .eq("user_id", userId)
    .not("comparison_result", "is", null)
    .order("created_at", { ascending: false })
    .limit(25);

  if (!past || past.length < 3) return null;

  const losses: Record<string, number> = {};
  const appearances: Record<string, number> = {};

  for (const session of past) {
    const result = session.comparison_result as CompareVerdict | null;
    if (!result?.factorBattles) continue;

    // Figure out which report id corresponds to which label in this session
    const idsByLabel: Partial<Record<Label, string>> = {
      A: session.thumbnail_a, B: session.thumbnail_b, C: session.thumbnail_c ?? undefined,
    };
    // We only know report ids, not the *creator's own thumbnail* across
    // different comparisons, so this aggregates across the reports the
    // user has chosen to compare — a solid proxy for their recurring
    // weak spot since they keep pitting their own work against itself.
    for (const fb of result.factorBattles) {
      for (const label of result.contenders) {
        const key = fb.factor;
        appearances[key] = (appearances[key] ?? 0) + 1;
        if (fb.advantage !== "tie" && fb.advantage !== label) {
          losses[key] = (losses[key] ?? 0) + 1;
        }
      }
    }
  }

  let worst: { factor: string; rate: number; n: number } | null = null;
  for (const factor of Object.keys(appearances)) {
    const n = appearances[factor];
    if (n < 6) continue; // not enough signal yet
    const rate = (losses[factor] ?? 0) / n;
    if (!worst || rate > worst.rate) worst = { factor, rate, n };
  }

  if (!worst || worst.rate < 0.5) return null;

  const label = FACTOR_LABELS[worst.factor as keyof typeof FACTOR_LABELS] ?? worst.factor;
  return {
    factor: worst.factor,
    lossRate: Math.round(worst.rate * 100) / 100,
    sampleSize: worst.n,
    message: `Across your last ${past.length} comparisons, ${label} is the factor you lose on most often (${Math.round(worst.rate * 100)}% of the time). This is worth fixing before your next upload.`,
  };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    // ── Authenticate ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Authentication required", 401);

    const jwt = authHeader.slice(7);
    const tempClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: { user }, error: authError } = await tempClient.auth.getUser(jwt);
    if (authError || !user) return errorResponse("Invalid token", 401);

    // ── Parse Body ───────────────────────────────────────────────────────
    let body: ComparisonRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const { thumbnailA, thumbnailB, thumbnailC } = body;
    if (!thumbnailA || !thumbnailB) {
      return errorResponse("thumbnailA and thumbnailB are required", 400);
    }
    if (thumbnailC && (thumbnailC === thumbnailA || thumbnailC === thumbnailB)) {
      return errorResponse("thumbnailC must be different from A and B", 400);
    }

    const ids = [thumbnailA, thumbnailB, ...(thumbnailC ? [thumbnailC] : [])];

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── Fetch reports (need full metrics for grounding, not just display fields) ──
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from("reports")
      .select(REPORT_FIELDS)
      .in("id", ids)
      .eq("user_id", user.id);

    if (reportsError) {
      console.error("Reports query error:", reportsError);
      return errorResponse("Failed to fetch reports", 500);
    }
    if (!reports || reports.length !== ids.length) {
      return errorResponse("All selected thumbnails must exist and belong to you", 404);
    }

    const byId = new Map(reports.map((r) => [r.id, r]));
    const reportA = byId.get(thumbnailA)!;
    const reportB = byId.get(thumbnailB)!;
    const reportC = thumbnailC ? byId.get(thumbnailC)! : null;

    // ── Cache check — exact same set of ids, either order, same arity ────
    const cacheFilter = thumbnailC
      ? `and(thumbnail_a.eq.${thumbnailA},thumbnail_b.eq.${thumbnailB},thumbnail_c.eq.${thumbnailC}),and(thumbnail_a.eq.${thumbnailB},thumbnail_b.eq.${thumbnailA},thumbnail_c.eq.${thumbnailC})`
      : `and(thumbnail_a.eq.${thumbnailA},thumbnail_b.eq.${thumbnailB},thumbnail_c.is.null),and(thumbnail_a.eq.${thumbnailB},thumbnail_b.eq.${thumbnailA},thumbnail_c.is.null)`;

    const { data: existingSession } = await supabaseAdmin
      .from("comparison_sessions")
      .select("comparison_result, winner_id")
      .or(cacheFilter)
      .not("comparison_result", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let verdict: CompareVerdict;

    if (existingSession?.comparison_result) {
      verdict = existingSession.comparison_result as CompareVerdict;
    } else {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      const groqKey = Deno.env.get("GROQ_API_KEY");
      if (!geminiKey && !groqKey) {
        return errorResponse("No comparison provider configured", 500);
      }

      const inputs: ThumbnailInput[] = [
        { label: "A", imageUrl: reportA.image_url, niche: reportA.niche, stored: reportA },
        { label: "B", imageUrl: reportB.image_url, niche: reportB.niche, stored: reportB },
        ...(reportC ? [{ label: "C" as Label, imageUrl: reportC.image_url, niche: reportC.niche, stored: reportC }] : []),
      ];

      try {
        verdict = await compareWithFallback(inputs, [
          { comparator: new GeminiComparator(), apiKey: geminiKey },
          { comparator: new GroqComparator(), apiKey: groqKey },
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Comparison failed";
        console.error("Comparison provider error:", msg);
        return errorResponse(`Comparison failed: ${msg}`, 502);
      }
    }

    const winnerReport =
      verdict.overallWinner === "A" ? reportA :
      verdict.overallWinner === "B" ? reportB :
      verdict.overallWinner === "C" ? reportC :
      null;
    const winnerId = winnerReport?.id ?? null;

    // ── Save the session (skip if served from cache) ──────────────────────
    if (!existingSession?.comparison_result) {
      const { error: sessionError } = await supabaseAdmin.from("comparison_sessions").insert({
        user_id: user.id,
        thumbnail_a: thumbnailA,
        thumbnail_b: thumbnailB,
        thumbnail_c: thumbnailC ?? null,
        winner_id: winnerId,
        comparison_result: verdict,
      });
      if (sessionError) console.error("Session save error:", sessionError); // non-fatal
    }

    // ── Recurring pattern across this user's history (best-effort) ────────
    let recurringPattern: RecurringPattern | null = null;
    try {
      recurringPattern = await computeRecurringPattern(supabaseAdmin, user.id, ids);
    } catch (err) {
      console.error("Pattern computation error:", err); // non-fatal
    }

    // ── Response ─────────────────────────────────────────────────────────
    const thumbnails = [
      { ...reportA, label: "A" as const },
      { ...reportB, label: "B" as const },
      ...(reportC ? [{ ...reportC, label: "C" as const }] : []),
    ];

    return jsonResponse({
      thumbnails,
      winner: winnerId,
      verdict,
      recurringPattern,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Unhandled error in compare-thumbnails:", message);
    return errorResponse(message, 500);
  }
});