// youtube-connect/index.ts
//
// Call this ONCE right after your frontend's Google OAuth redirect gives
// you a `code`. This is the only place a YouTube access/refresh token
// pair is created — from here on, youtube-sync mints its own fresh access
// tokens server-side and the client never sees a YouTube token again.
//
// Add to supabase/config.toml:
//   [functions.youtube-connect]
//   enabled = true
//   verify_jwt = true
//   entrypoint = "./functions/youtube-connect/index.ts"

import { createClient } from "../_shared/deps.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { exchangeCodeForTokens } from "../_shared/google-oauth.ts";
import type { YouTubeConnectRequest } from "../_shared/types.ts";

const YOUTUBE_API_BASE = "https://youtube.googleapis.com/youtube/v3";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
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

    const body: YouTubeConnectRequest = await req.json();
    const { code, redirectUri } = body;
    if (!code || !redirectUri) return errorResponse("code and redirectUri are required", 400);

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

    const tokens = await exchangeCodeForTokens(code, redirectUri, clientId, clientSecret);

    if (!tokens.refresh_token) {
      // Google only returns a refresh_token on the FIRST consent grant for
      // a given user+scope combo. If they've connected before and revoked
      // scope-less, you may need to force `prompt=consent` on the frontend
      // OAuth URL to guarantee one comes back.
      return errorResponse(
        "No refresh token returned — add prompt=consent&access_type=offline to your Google OAuth URL",
        400,
      );
    }

    // Confirm the token actually works and grab the channel id while we're at it
    const channelRes = await fetch(`${YOUTUBE_API_BASE}/channels?part=id&mine=true`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const channelId = channelRes.ok ? (await channelRes.json())?.items?.[0]?.id ?? null : null;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { error: upsertError } = await supabaseAdmin.from("youtube_connections").upsert({
      user_id: user.id,
      refresh_token: tokens.refresh_token,
      channel_id: channelId,
      connected_at: new Date().toISOString(),
    });

    if (upsertError) {
      console.error("Failed to store YouTube connection:", upsertError);
      return errorResponse("Failed to save connection", 500);
    }

    return jsonResponse({ success: true, channel_id: channelId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Unhandled error in youtube-connect:", message);
    return errorResponse(message, 500);
  }
});