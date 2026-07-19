// functions/channel-audit/index.ts
//
// AI Channel Audit endpoint. Mirrors research/index.ts's shape (CORS ->
// auth -> rate limit -> plan gate -> cache check -> do the work -> save
// -> respond) but reads from data the app already has instead of calling
// out to Apify: the user's synced youtube_videos, left-joined with any
// Thumbnail Analysis `reports` rows already produced by
// analyze-thumbnail/index.ts. No new data collection, no duplicate
// business logic — see _shared/channel-audit-service.ts for the actual
// computation + AI narrative pass.

import {
  jsonResponse,
  errorResponse,
  getCorsHeaders,
} from "../_shared/cors.ts";
import { createClient } from "../_shared/deps.ts";
import { createLogger } from "../_shared/logger.ts";
import { authRateLimiter } from "../_shared/rate-limiter.ts";
import {
  ChannelAuditRequestSchema,
  validateRequest,
} from "../_shared/validation.ts";
import { logChannelAuditGenerated } from "../_shared/audit.ts";
import { applySecurityHeaders } from "../_shared/security-headers.ts";
import {
  runChannelAudit,
  ChannelAuditVideoInput,
  MIN_VIDEOS_FOR_AUDIT,
} from "../_shared/channel-audit-service.ts";

const logger = createLogger("channel-audit");

// One AI narrative pass per audit run, same tier gate as Research Engine
// (Compare/Research/Channel Audit are all Creator+ features).
const PLAN_LIMITS: Record<string, number> = {
  creator: 10,
  business: 40,
  agency: 150,
};

const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
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
    let body: unknown = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return applySecurityHeaders(errorResponse("Invalid JSON body", 400, req));
    }

    const { force } = validateRequest(ChannelAuditRequestSchema, body);

    // ── Auth (required — Creator+ feature, no guest access) ──────────────
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

    const rateCheck = await authRateLimiter.checkLimit(`user:${user.id}:channel-audit`, {
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

    // ── Plan gate ──────────────────────────────────────────────────────────
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
          "AI Channel Audit is available on Creator, Business, and Agency plans. Please upgrade to continue.",
          402,
          req,
        ),
      );
    }

    // ── Cache check (unless the user explicitly asked to refresh) ────────
    if (!force) {
      const cutoff = new Date(Date.now() - CACHE_MAX_AGE_MS).toISOString();
      const { data: cached } = await supabaseAdmin
        .from("channel_audits")
        .select("id, report, overall_channel_score, videos_analyzed_count, channel_video_count, created_at")
        .eq("user_id", user.id)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        logger.info("Cache hit for channel audit", { correlationId, userId: user.id });
        return applySecurityHeaders(
          jsonResponse(
            { success: true, audit: { id: cached.id, created_at: cached.created_at, was_cached: true, ...cached.report } },
            200,
            req,
          ),
        );
      }
    }

    // ── Monthly usage gate (only counts fresh runs, not cache hits) ───────
    const { count } = await supabaseAdmin
      .from("channel_audits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth());

    if ((count ?? 0) >= limit) {
      return applySecurityHeaders(
        errorResponse(`Monthly Channel Audit limit reached (${count}/${limit}).`, 429, req),
      );
    }

    // ── Pull already-synced YouTube data + linked reports ─────────────────
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("youtube_videos")
      .select(
        `
        youtube_video_id,
        title,
        thumbnail_url,
        views,
        published_at,
        reports (
          overall_score,
          niche,
          thumbnail_style,
          brand_score,
          contrast_score,
          verdict
        )
      `,
      )
      .eq("user_id", user.id)
      .order("published_at", { ascending: false })
      .limit(100);

    if (videosError) {
      logger.error("Failed to load synced videos", videosError, { correlationId, userId: user.id });
      return applySecurityHeaders(errorResponse("Failed to load synced YouTube videos", 500, req));
    }

    const videoInputs: ChannelAuditVideoInput[] = (videos ?? []).map((v: any) => ({
      youtube_video_id: v.youtube_video_id,
      title: v.title,
      thumbnail_url: v.thumbnail_url,
      views: v.views,
      published_at: v.published_at,
      report: Array.isArray(v.reports) ? v.reports[0] ?? null : v.reports ?? null,
    }));

    if (videoInputs.length < MIN_VIDEOS_FOR_AUDIT) {
      return applySecurityHeaders(
        errorResponse(
          `Not enough synced videos to run a Channel Audit (need at least ${MIN_VIDEOS_FOR_AUDIT}, have ${videoInputs.length}). Connect your YouTube channel and sync videos first.`,
          422,
          req,
        ),
      );
    }

    // ── Run the audit ─────────────────────────────────────────────────────
    const report = await runChannelAudit(videoInputs);

    // ── Save ───────────────────────────────────────────────────────────────
    const { data: saved, error: saveError } = await supabaseAdmin
      .from("channel_audits")
      .insert({
        user_id: user.id,
        overall_channel_score: report.overall_channel_score,
        videos_analyzed_count: report.videos_analyzed_count,
        channel_video_count: report.channel_video_count,
        report,
      })
      .select("id, created_at")
      .single();

    if (saveError) {
      logger.error("DB save error", saveError, { correlationId, userId: user.id });
      return applySecurityHeaders(errorResponse(saveError.message, 500, req));
    }

    await logChannelAuditGenerated(
      user.id,
      saved.id,
      report.overall_channel_score,
      report.videos_analyzed_count,
      req,
    );

    return applySecurityHeaders(
      jsonResponse(
        { success: true, audit: { id: saved.id, created_at: saved.created_at, was_cached: false, ...report } },
        200,
        req,
      ),
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