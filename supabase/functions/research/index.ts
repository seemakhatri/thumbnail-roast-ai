// functions/research/index.ts
//
// Research Engine endpoint. Mirrors analyze-thumbnail/index.ts's shape
// (CORS -> auth -> rate limit -> plan/usage check -> cache check ->
// do the expensive work -> save -> respond) so the request lifecycle is
// familiar to anyone who has read that function, but swaps the AI
// vision call for research-service.ts's Apify + AI insight pipeline.

import {
  jsonResponse,
  errorResponse,
  getCorsHeaders,
} from "../_shared/cors.ts";
import { createClient } from "../_shared/deps.ts";
import { createLogger } from "../_shared/logger.ts";
import { authRateLimiter } from "../_shared/rate-limiter.ts";
import {
  ResearchRequestSchema,
  validateRequest,
} from "../_shared/validation.ts";
import { logResearchSession } from "../_shared/audit.ts";
import { applySecurityHeaders } from "../_shared/security-headers.ts";
import { runResearch, ResearchMode } from "../_shared/research-service.ts";

const logger = createLogger("research");

// Apify actor runs cost real money per call, so this is a paid-plan
// feature (unlike guest-accessible thumbnail analysis). Monthly caps
// mirror the tiering used for analyses in analyze-thumbnail/index.ts.
const PLAN_LIMITS: Record<string, number> = {
  creator: 15,
  business: 75,
  agency: 300,
};

const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function cacheKey(mode: ResearchMode, input: string): string {
  return `${mode}:${input.trim().toLowerCase()}`;
}

Deno.serve(async (req: Request) => {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    const headers = getCorsHeaders(origin);
    return new Response(null, { status: 204, headers: { ...headers, "Content-Length": "0" } });
  }

  if (req.method !== "POST") {
    return applySecurityHeaders(errorResponse("Method not allowed", 405, req));
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applySecurityHeaders(errorResponse("Invalid JSON body", 400, req));
    }

    const { mode, input } = validateRequest(ResearchRequestSchema, body);

    // ── Auth (required — this is a paid feature, no guest access) ────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return applySecurityHeaders(errorResponse("Authentication required", 401, req));
    }

    const jwt = authHeader.slice(7);
    const tempClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: { user }, error: authError } = await tempClient.auth.getUser(jwt);
    if (authError || !user) {
      return applySecurityHeaders(errorResponse("Invalid token", 401, req));
    }

    const rateCheck = await authRateLimiter.checkLimit(`user:${user.id}:research`, {
      windowMs: 60000,
      maxRequests: 5,
    });
    if (!rateCheck.allowed) {
      const remainingSeconds = Math.ceil((rateCheck.resetAt.getTime() - Date.now()) / 1000);
      return applySecurityHeaders(
        errorResponse(`Rate limit exceeded. Try again in ${remainingSeconds} seconds`, 429, req),
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── Plan + usage gate ─────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return applySecurityHeaders(errorResponse("User profile not found", 404, req));
    }

    const limit = PLAN_LIMITS[profile.plan as string];
    if (!limit) {
      return applySecurityHeaders(
        errorResponse(
          "Research Engine is available on Creator, Business, and Agency plans. Please upgrade to continue.",
          402,
          req,
        ),
      );
    }

    const { count } = await supabaseAdmin
      .from("research_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth());

    if ((count ?? 0) >= limit) {
      return applySecurityHeaders(
        errorResponse(`Monthly research limit reached (${count}/${limit}).`, 429, req),
      );
    }

    // ── Cache check (channel_snapshots) ───────────────────────────────────
    const key = cacheKey(mode, input);
    const cutoff = new Date(Date.now() - CACHE_MAX_AGE_MS).toISOString();

    const { data: cachedSnapshot } = await supabaseAdmin
      .from("channel_snapshots")
      .select("summary, fetched_at")
      .eq("mode", mode)
      .eq("cache_key", key)
      .gte("fetched_at", cutoff)
      .maybeSingle();

    let insights;
    if (cachedSnapshot) {
      logger.info("Cache hit for research input", { correlationId, mode, input });
      insights = cachedSnapshot.summary;
    } else {
      insights = await runResearch(mode, input);

      // Best-effort cache write — a failure here shouldn't fail the request.
      const { error: cacheError } = await supabaseAdmin
        .from("channel_snapshots")
        .upsert(
          { mode, cache_key: key, summary: insights, fetched_at: new Date().toISOString() },
          { onConflict: "mode,cache_key" },
        );
      if (cacheError) logger.warn("Failed to write channel_snapshots cache", { cacheError });
    }

    // ── Save session ───────────────────────────────────────────────────────
    const { data: session, error: saveError } = await supabaseAdmin
      .from("research_sessions")
      .insert({
        user_id: user.id,
        mode,
        input,
        insights,
        data_points_analyzed: insights.data_points_analyzed ?? 0,
      })
      .select()
      .single();

    if (saveError) {
      logger.error("DB save error", saveError, { correlationId, userId: user.id });
      return applySecurityHeaders(errorResponse(saveError.message, 500, req));
    }

    await logResearchSession(user.id, session.id, mode, input, req);

    return applySecurityHeaders(
      jsonResponse({ success: true, session: { id: session.id, mode, input, insights } }, 200, req),
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    logger.error("Unhandled error", error as Error, { correlationId });
    return applySecurityHeaders(
      errorResponse(
        Deno.env.get("ENV") === "production" ? "An internal error occurred" : errorMessage,
        500,
        req,
      ),
    );
  }
});
