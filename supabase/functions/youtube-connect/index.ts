// functions/youtube-connect/index.ts

import { createClient } from "../_shared/deps.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse
} from "../_shared/cors.ts";
import { refreshAccessToken } from "../_shared/google-oauth.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  YouTubeConnectRequestSchema,
  validateRequest
} from "../_shared/validation.ts";
import { getEncryptionService } from "../_shared/encryption.ts";
import { youtubeCircuitBreaker } from "../_shared/circuit-breaker.ts";
import { logYouTubeConnected } from "../_shared/audit.ts";
import { applySecurityHeaders } from "../_shared/security-headers.ts";
import { getConfig } from "../_shared/config.ts";

const logger = createLogger("youtube-connect");
const config = getConfig();
const YOUTUBE_API_BASE = "https://youtube.googleapis.com/youtube/v3";

Deno.serve(async (req: Request) => {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  logger.info("YouTube connect request started", { correlationId });

  // CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return applySecurityHeaders(corsResponse);

  if (req.method !== "POST") {
    const response = errorResponse("Method not allowed", 405, req);
    return applySecurityHeaders(response);
  }

  try {
    // ── Authenticate ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      const response = errorResponse("Authentication required", 401, req);
      return applySecurityHeaders(response);
    }

    const jwt = authHeader.slice(7);
    const tempClient = createClient(
      config.get("SUPABASE_URL"),
      config.get("SUPABASE_ANON_KEY"),
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: authError } = await tempClient.auth.getUser(jwt);
    if (authError || !user) {
      logger.warn("Invalid token", { correlationId, error: authError?.message });
      const response = errorResponse("Invalid token", 401, req);
      return applySecurityHeaders(response);
    }

    logger.info("Authenticated user", { correlationId, userId: user.id });

    // ── Validate Request ──────────────────────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch {
      const response = errorResponse("Invalid JSON body", 400, req);
      return applySecurityHeaders(response);
    }

    const validated = validateRequest(YouTubeConnectRequestSchema, body);
    const { providerRefreshToken } = validated;

    // ── Validate with YouTube using Circuit Breaker ─────────────────────
    const clientId = config.getOptional("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = config.getOptional("GOOGLE_OAUTH_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      logger.error("Google OAuth not configured", { correlationId });
      const response = errorResponse("Google OAuth is not configured", 500, req);
      return applySecurityHeaders(response);
    }

    // Get fresh access token with circuit breaker
    let accessToken: string;
    try {
      const tokens = await youtubeCircuitBreaker.execute(() =>
        refreshAccessToken(providerRefreshToken, clientId, clientSecret)
      );
      accessToken = tokens.access_token;
    } catch (error) {
      // ✅ FIXED: Pass error as string in metadata
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Token refresh failed", { correlationId, error: errorMessage });
      const response = errorResponse(
        "YouTube connection expired. Please reconnect your account.",
        401,
        req
      );
      return applySecurityHeaders(response);
    }

    // Verify channel
    const channelRes = await youtubeCircuitBreaker.execute(async () => {
      const res = await fetch(
        `${YOUTUBE_API_BASE}/channels?part=id&mine=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
      return res;
    });

    const channelData = await channelRes.json();
    const channelId = channelData?.items?.[0]?.id;

    if (!channelId) {
      logger.warn("No YouTube channel found", { correlationId, userId: user.id });
      const response = errorResponse("No YouTube channel found", 404, req);
      return applySecurityHeaders(response);
    }

    // ── Encrypt and Store ──────────────────────────────────────────────────
    const encryption = getEncryptionService();
    const encryptedToken = await encryption.encrypt(providerRefreshToken);

    const supabaseAdmin = createClient(
      config.get("SUPABASE_URL"),
      config.get("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    // ✅ FIXED: Removed 'upserted' variable
    const { error: upsertError } = await supabaseAdmin
      .from("youtube_connections")
      .upsert({
        user_id: user.id,
        refresh_token_encrypted: encryptedToken,
        channel_id: channelId,
        connected_at: new Date().toISOString(),
        last_synced_at: null,
      })
      .select()
      .single();

    if (upsertError) {
      // ✅ FIXED: Pass error as string in metadata
      logger.error("DB upsert failed", { 
        correlationId, 
        userId: user.id, 
        error: upsertError.message 
      });
      const response = errorResponse(`Failed to save connection: ${upsertError.message}`, 500, req);
      return applySecurityHeaders(response);
    }

    // ── Audit Log ──────────────────────────────────────────────────────────
    await logYouTubeConnected(user.id, channelId, req);

    logger.info("YouTube connected successfully", {
      correlationId,
      userId: user.id,
      channelId
    });

    const response = jsonResponse({
      success: true,
      channel_id: channelId
    }, 200, req);
    return applySecurityHeaders(response);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    // ✅ FIXED: Pass error as string in metadata
    logger.error("YouTube connect error", { correlationId, error: errorMessage });

    const response = errorResponse(
      config.isProduction() ? "Failed to connect YouTube" : errorMessage,
      500,
      req
    );
    return applySecurityHeaders(response);
  }
});