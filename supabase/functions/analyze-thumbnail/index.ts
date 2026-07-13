// functions/analyze-thumbnail/index.ts - PRODUCTION VERSION

import { 
  handleCors, 
  jsonResponse, 
  errorResponse,
  getCorsHeaders 
} from "../_shared/cors.ts";
import { createClient } from "../_shared/deps.ts";
import { analyzeThumbnailStable } from "../_shared/gemini.ts";
import { hashImageUrl } from "../_shared/image-cache.ts";
import { createLogger } from "../_shared/logger.ts";
import { 
  apiRateLimiter, 
  guestRateLimiter, 
  authRateLimiter 
} from "../_shared/rate-limiter.ts";
import { 
  AnalyzeRequestSchema, 
  validateRequest,
  withValidation 
} from "../_shared/validation.ts";
import { 
  geminiCircuitBreaker 
} from "../_shared/circuit-breaker.ts";
import { 
  logThumbnailAnalyzed 
} from "../_shared/audit.ts";
import { 
  getEncryptionService 
} from "../_shared/encryption.ts";
import { 
  applySecurityHeaders 
} from "../_shared/security-headers.ts";

const logger = createLogger("analyze-thumbnail");
const ENV = Deno.env.get("ENV") || "development";

const PLAN_LIMITS: Record<string, number> = {
  guest: 3,
  free: 3,
  creator: 50,
  business: 200,
  agency: 500,
};

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
  const startTime = Date.now();
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const origin = req.headers.get("origin");
  
  // Enhanced logging with correlation ID
  logger.info("Request started", { 
    correlationId, 
    method: req.method,
    path: new URL(req.url).pathname,
  });

  // CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return applySecurityHeaders(corsResponse);

  if (req.method !== "POST") {
    const response = errorResponse("Method not allowed", 405, req);
    return applySecurityHeaders(response);
  }

  try {
    // ── Rate Limiting ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let isAuthenticated = false;

    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.slice(7);
      const tempClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } }
      );
      const { data: { user } } = await tempClient.auth.getUser(jwt);
      if (user) {
        userId = user.id;
        isAuthenticated = true;
      }
    }

    // Apply rate limits
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    const rateLimiter = isAuthenticated ? authRateLimiter : guestRateLimiter;
    const identifier = isAuthenticated ? `user:${userId}` : `ip:${clientIp}`;
    
    // Different limits for authenticated vs guest
    const rateCheck = await rateLimiter.checkLimit(identifier, {
      windowMs: isAuthenticated ? 60000 : 3600000,
      maxRequests: isAuthenticated ? 10 : 3,
    });

    if (!rateCheck.allowed) {
      const remainingSeconds = Math.ceil((rateCheck.resetAt.getTime() - Date.now()) / 1000);
      
      // Add rate limit headers
      const headers = {
        ...getCorsHeaders(origin),
        "X-RateLimit-Limit": String(rateCheck.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(rateCheck.resetAt.getTime() / 1000)),
        "Retry-After": String(remainingSeconds),
      };

      logger.warn("Rate limit exceeded", { 
        correlationId, 
        identifier, 
        resetAt: rateCheck.resetAt 
      });

      return new Response(
        JSON.stringify({ 
          error: `Rate limit exceeded. Try again in ${remainingSeconds} seconds` 
        }),
        {
          status: 429,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ── Validate Request ──────────────────────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch {
      const response = errorResponse("Invalid JSON body", 400, req);
      return applySecurityHeaders(response);
    }

    const validated = validateRequest(AnalyzeRequestSchema, body);
    const { imageUrl } = validated;

    if (!isValidStorageUrl(imageUrl)) {
      const response = errorResponse("imageUrl must be a Supabase Storage URL", 400, req);
      return applySecurityHeaders(response);
    }

    // ── Check Limits ──────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    let userPlan = "free";

    if (userId) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("plan, analyses_used, analyses_limit")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        const response = errorResponse("User profile not found", 404, req);
        return applySecurityHeaders(response);
      }

      userPlan = profile.plan ?? "free";

      const { count } = await supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth());

      const limit = PLAN_LIMITS[profile.plan] ?? 3;
      const used = count ?? 0;

      if (used >= limit) {
        logger.warn("User reached monthly limit", { userId, used, limit });
        const response = errorResponse(
          `Monthly limit reached (${used}/${limit}). Please upgrade your plan.`,
          429,
          req
        );
        return applySecurityHeaders(response);
      }
    } else {
      const { count } = await supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .is("user_id", null)
        .eq("guest_ip", clientIp)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if ((count ?? 0) >= 3) {
        const response = errorResponse(
          "Guest limit reached (3 analyses per 24h). Sign in for more.",
          429,
          req
        );
        return applySecurityHeaders(response);
      }
    }

    // ── Cache Check ──────────────────────────────────────────────────────
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
      const { user_id: _uid, guest_ip: _ip, ...publicReport } = cached;
      
      logger.info("Cache hit", { 
        correlationId, 
        reportId: cached.id,
        userId: userId || "guest"
      });

      const response = jsonResponse({ 
        success: true, 
        report: { ...publicReport, was_cached: true } 
      }, 200, req);
      return applySecurityHeaders(response);
    }

    // ── Call AI with Circuit Breaker ──────────────────────────────────────
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      const response = errorResponse("No vision provider configured", 500, req);
      return applySecurityHeaders(response);
    }

    // Paid plans get 3-pass averaging
    const passes = userPlan === "creator" || userPlan === "business" || userPlan === "agency" ? 3 : 1;

    let analysis;
    try {
      analysis = await geminiCircuitBreaker.execute(() =>
        analyzeThumbnailStable(imageUrl, geminiKey, passes)
      );
    } catch (circuitError) {
      // Circuit breaker open - try fallback
      logger.error("Circuit breaker open or API failed", circuitError as Error, {
        correlationId,
        userId: userId || "guest",
      });

      // Attempt fallback with Groq if available
      const groqKey = Deno.env.get("GROQ_API_KEY");
      if (groqKey) {
        try {
          // Import Groq analyzer
          const { analyzeWithFallback, GroqAnalyzer } = await import("../_shared/vision-analyzer.ts");
          const result = await analyzeWithFallback(imageUrl, [
            { analyzer: new GroqAnalyzer(), apiKey: groqKey },
          ]);
          analysis = result.analysis;
          logger.info("Used Groq fallback successfully", { correlationId });
        } catch (groqError) {
          logger.error("Groq fallback also failed", groqError as Error, { correlationId });
          const response = errorResponse("All AI providers are currently unavailable", 502, req);
          return applySecurityHeaders(response);
        }
      } else {
        const response = errorResponse("AI service temporarily unavailable", 502, req);
        return applySecurityHeaders(response);
      }
    }

    // ── Save Report ──────────────────────────────────────────────────────
    const reportRecord = {
      user_id: userId ?? null,
      guest_ip: userId ? null : clientIp,
      image_url: imageUrl,
      image_hash: imageHash,
      analyzed_by: "gemini",
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
      logger.error("DB save error", saveError, { correlationId, userId });
      const response = errorResponse(
        `${saveError.message} | ${saveError.details ?? ""}`,
        500,
        req
      );
      return applySecurityHeaders(response);
    }

    // ── Audit Log ──────────────────────────────────────────────────────
    await logThumbnailAnalyzed(
      userId,
      savedReport.id,
      analysis.overall_score,
      analysis.niche || "unknown",
      req
    );

    // ── Increment Usage ──────────────────────────────────────────────────
    if (userId) {
      await supabaseAdmin.rpc("increment_analyses_used", { user_id: userId });
    }

    // ── Response ──────────────────────────────────────────────────────────
    const { user_id: _uid, guest_ip: _ip, ...publicReport } = savedReport;

    const duration = Date.now() - startTime;
    logger.info("Request completed", { 
      correlationId, 
      duration,
      success: true,
      score: analysis.overall_score,
      userId: userId || "guest",
    });

    const response = jsonResponse({ 
      success: true, 
      report: publicReport 
    }, 200, req);
    return applySecurityHeaders(response);
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    logger.error("Unhandled error", error as Error, {
      correlationId,
      duration,
      path: new URL(req.url).pathname,
    });

    const response = errorResponse(
      Deno.env.get("ENV") === "production" ? "An internal error occurred" : errorMessage,
      500,
      req
    );
    return applySecurityHeaders(response);
  }
});