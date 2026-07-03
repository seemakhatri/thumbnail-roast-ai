import { createClient } from "../_shared/deps.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { refreshAccessToken } from "../_shared/google-oauth.ts";
import type { YouTubeSyncResponse } from "../_shared/types.ts";

const YOUTUBE_API_BASE = "https://youtube.googleapis.com/youtube/v3";

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── SECURITY FIX ────────────────────────────────────────────────────
    // We no longer accept a client-supplied accessToken. Instead we look
    // up the refresh token this user stored during OAuth connect and mint
    // a fresh access token server-side. The client never handles a
    // YouTube access token at all, so it can't be spoofed or replayed.
    const { data: connection, error: connError } = await supabaseAdmin
      .from("youtube_connections")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError || !connection) {
      return errorResponse("No YouTube account connected. Please reconnect.", 404);
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

    let accessToken: string;
    try {
      const tokens = await refreshAccessToken(connection.refresh_token, clientId, clientSecret);
      accessToken = tokens.access_token;
    } catch (err) {
      console.error("Token refresh failed:", err);
      return errorResponse("YouTube connection expired. Please reconnect your account.", 401);
    }

    // ── Fetch channel ────────────────────────────────────────────────────
    const channelRes = await fetch(`${YOUTUBE_API_BASE}/channels?part=id&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!channelRes.ok) {
      console.error("YouTube channel error:", await channelRes.text());
      return errorResponse("Failed to get YouTube channel", 502);
    }
    const channelId = (await channelRes.json())?.items?.[0]?.id;
    if (!channelId) return errorResponse("No YouTube channel found", 404);

    // ── Fetch recent videos ──────────────────────────────────────────────
    const videosRes = await fetch(
      `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${channelId}&maxResults=50&order=date&type=video`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!videosRes.ok) {
      console.error("YouTube search error:", await videosRes.text());
      return errorResponse("Failed to fetch videos", 502);
    }
    const videoItems = (await videosRes.json())?.items ?? [];

    // ── Fetch statistics for all videos in one batch call ────────────────
    const videoIds = videoItems.map((item: any) => item.id.videoId).join(",");
    const statsMap: Record<string, any> = {};
    if (videoIds) {
      const statsRes = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=statistics,snippet&id=${videoIds}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (statsRes.ok) {
        for (const item of (await statsRes.json())?.items ?? []) statsMap[item.id] = item;
      }
    }

    // ── Single pass: upsert video + link matched report ─────────────────
    // (The old version looped over videoItems TWICE — once to upsert,
    // once again to match+link a report — doing two DB round-trips per
    // video for no reason. This does it in one pass.)
    let synced = 0;

    for (const item of videoItems) {
      const videoId = item.id.videoId;
      const snippet = item.snippet;
      const stats = statsMap[videoId]?.statistics ?? {};
      const thumbnailUrl = snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null;

      const { data: matchedReport } = await supabaseAdmin
        .from("reports")
        .select("id")
        .eq("user_id", user.id)
        .eq("image_hash", thumbnailUrl ? await hashUrl(thumbnailUrl) : "")
        .maybeSingle();

      const record = {
        user_id: user.id,
        youtube_video_id: videoId,
        thumbnail_url: thumbnailUrl,
        title: snippet.title,
        views: Number(stats.viewCount ?? 0),
        impressions: Number(stats.viewCount ?? 0), // not exposed via public API
        actual_ctr: 0, // not available without YouTube Analytics API + owner auth
        published_at: snippet.publishedAt,
        report_id: matchedReport?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabaseAdmin
        .from("youtube_videos")
        .select("id")
        .eq("user_id", user.id)
        .eq("youtube_video_id", videoId)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin.from("youtube_videos").update(record).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("youtube_videos").insert(record);
        synced++;
      }
    }

    await supabaseAdmin
      .from("youtube_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", user.id);

    const response: YouTubeSyncResponse = {
      videos_synced: synced,
      total_videos: videoItems.length,
    };
    return jsonResponse(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Unhandled error in youtube-sync:", message);
    return errorResponse(message, 500);
  }
});

async function hashUrl(url: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}