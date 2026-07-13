import { createClient } from "../_shared/deps.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { refreshAccessToken } from "../_shared/google-oauth.ts";
import type { YouTubeSyncResponse } from "../_shared/types.ts";

const YOUTUBE_API_BASE = "https://youtube.googleapis.com/youtube/v3";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  console.log("[youtube-sync] request received");

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
    if (authError || !user) {
      console.error("[youtube-sync] invalid token:", authError?.message);
      return errorResponse("Invalid token", 401);
    }
    console.log("[youtube-sync] authenticated user:", user.id);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── Look up the stored refresh token ─────────────────────────────────
    const { data: connection, error: connError } = await supabaseAdmin
      .from("youtube_connections")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError) {
      console.error("[youtube-sync] DB error looking up connection:", connError.message);
      return errorResponse(`Failed to look up YouTube connection: ${connError.message}`, 500);
    }
    if (!connection) {
      console.warn("[youtube-sync] no youtube_connections row for user:", user.id);
      return errorResponse("No YouTube account connected. Please reconnect.", 404);
    }
    console.log("[youtube-sync] found stored connection for user:", user.id);

    // ── SECURITY: mint a fresh access token server-side ──────────────────
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      console.error("[youtube-sync] GOOGLE_OAUTH_CLIENT_ID/SECRET not configured");
      return errorResponse("Google OAuth is not configured on the server", 500);
    }

    let accessToken: string;
    try {
      const tokens = await refreshAccessToken(connection.refresh_token, clientId, clientSecret);
      accessToken = tokens.access_token;
    } catch (err) {
      console.error("[youtube-sync] token refresh failed:", err instanceof Error ? err.message : err);
      return errorResponse("YouTube connection expired. Please reconnect your account.", 401);
    }
    console.log("[youtube-sync] minted fresh access token");

    // ── Fetch channel ────────────────────────────────────────────────────
    const channelRes = await fetch(`${YOUTUBE_API_BASE}/channels?part=id&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!channelRes.ok) {
      console.error("[youtube-sync] YouTube channel error:", channelRes.status, await channelRes.text());
      return errorResponse("Failed to get YouTube channel", 502);
    }
    const channelId = (await channelRes.json())?.items?.[0]?.id;
    if (!channelId) return errorResponse("No YouTube channel found", 404);
    console.log("[youtube-sync] channel id:", channelId);

    // ── Fetch ALL videos (pagination) ─────────────────────────────────────
    const videoItems: any[] = [];
    let nextPageToken: string | undefined = undefined;

    do {
      const params = new URLSearchParams({
        part: "snippet",
        channelId,
        maxResults: "50",
        order: "date",
        type: "video",
      });

      if (nextPageToken) {
        params.set("pageToken", nextPageToken);
      }

      const videosRes = await fetch(
        `${YOUTUBE_API_BASE}/search?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!videosRes.ok) {
        console.error("[youtube-sync] YouTube search error:", videosRes.status, await videosRes.text());
        return errorResponse("Failed to fetch videos", 502);
      }

      const json = await videosRes.json();
      if (json.items?.length) {
        videoItems.push(...json.items);
      }
      nextPageToken = json.nextPageToken;
    } while (nextPageToken);

    console.log(`[youtube-sync] fetched ${videoItems.length} videos across all pages`);

    if (videoItems.length === 0) {
      return jsonResponse({
        processed: 0,
        inserted: 0,
        updated: 0,
        videos_synced: 0,
        total_videos: 0,
      });
    }

    // ── Fetch statistics for all videos ────────────────────────────────
    const videoIds = videoItems.map((item: any) => item.id.videoId).join(",");
    const statsMap: Record<string, any> = {};
    if (videoIds) {
      const statsRes = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=statistics,snippet&id=${videoIds}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (statsRes.ok) {
        for (const item of (await statsRes.json())?.items ?? []) {
          statsMap[item.id] = item;
        }
      } else {
        console.error("[youtube-sync] YouTube stats error:", statsRes.status, await statsRes.text());
      }
    }

    // ── Cache reports (1 query) ─────────────────────────────────────────
    const { data: reports } = await supabaseAdmin
      .from("reports")
      .select("id, image_hash, youtube_video_id")
      .eq("user_id", user.id);

    const reportByHash = new Map<string, string>();
    const reportByVideoId = new Map<string, string>();
    for (const report of reports ?? []) {
      if (report.youtube_video_id) {
        reportByVideoId.set(report.youtube_video_id, report.id);
      }
      if (report.image_hash) {
        reportByHash.set(report.image_hash, report.id);
      }
    }

    // ── Cache existing videos (1 query) ─────────────────────────────────
    const { data: existingVideos } = await supabaseAdmin
      .from("youtube_videos")
      .select("id, youtube_video_id")
      .eq("user_id", user.id);

    const existingVideoMap = new Map<string, string>();
    for (const video of existingVideos ?? []) {
      existingVideoMap.set(video.youtube_video_id, video.id);
    }

    // ── Build records ─────────────────────────────────────────────────────
    const records: any[] = [];
    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of videoItems) {
      const videoId = item.id.videoId;
      const snippet = item.snippet;
      const stats = statsMap[videoId]?.statistics ?? {};
      const thumbnailUrl = snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null;

      // Find matching report
      let reportId: string | null = null;
      if (reportByVideoId.has(videoId)) {
        reportId = reportByVideoId.get(videoId)!;
      } else if (thumbnailUrl) {
        const hash = await hashUrl(thumbnailUrl);
        if (reportByHash.has(hash)) {
          reportId = reportByHash.get(hash)!;
        }
      }

      const isExisting = existingVideoMap.has(videoId);
      if (isExisting) {
        updatedCount++;
      } else {
        insertedCount++;
      }

      records.push({
        user_id: user.id,
        youtube_video_id: videoId,
        thumbnail_url: thumbnailUrl,
        title: snippet.title,
        views: Number(stats.viewCount ?? 0),
        impressions: Number(stats.viewCount ?? 0),
        actual_ctr: 0,
        published_at: snippet.publishedAt,
        report_id: reportId,
        updated_at: new Date().toISOString(),
      });
    }

    // ── Batch upsert ──────────────────────────────────────────────────────
    if (records.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("youtube_videos")
        .upsert(records, {
          onConflict: "user_id,youtube_video_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error("[youtube-sync] Batch upsert failed:", upsertError);
        return errorResponse(`Failed to save videos: ${upsertError.message}`, 500);
      }
    }

    // ── Update last_synced_at ─────────────────────────────────────────────
    await supabaseAdmin
      .from("youtube_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", user.id);

    console.log(`[youtube-sync] sync complete: ${insertedCount} inserted, ${updatedCount} updated`);

    // ── Return BOTH formats for compatibility ────────────────────────────
    return jsonResponse({
      processed: records.length,
      inserted: insertedCount,
      updated: updatedCount,
      videos_synced: insertedCount,  // Keep old field for backward compatibility
      total_videos: videoItems.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[youtube-sync] unhandled error:", message);
    return errorResponse(message, 500);
  }
});

async function hashUrl(url: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}