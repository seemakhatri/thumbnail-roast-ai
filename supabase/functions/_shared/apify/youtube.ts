// _shared/apify/youtube.ts
//
// YouTube-specific data collection built on top of apify/client.ts.
// This is the Data Layer's YouTube adapter: Research/Competitor/Trend
// services call these functions and get back normalized TypeScript
// objects — they never touch Apify's raw dataset item shape directly.
//
// Actor selection is env-driven, same pattern as OPENROUTER_MODEL:
//   APIFY_YT_ACTOR   defaults to "streamers/youtube-scraper", the actor
//                    used for both search-by-keyword and direct channel/
//                    video URL scraping (confirmed input fields:
//                    searchQueries, startUrls, maxResults,
//                    maxResultsShorts, maxResultStreams).
//
// NOTE ON OUTPUT FIELD NAMES: Apify actor output shapes are not
// contractually stable across actor versions the way an API schema is.
// `normalizeVideoItem` below reads a handful of common candidate field
// names per attribute so minor upstream renames degrade gracefully
// instead of silently zeroing out a field. Once this is wired to a real
// APIFY_API_TOKEN, run one small query, log `rawSample`, and tighten the
// candidate list to match exactly what comes back for your actor build.

import { runApifyActor } from "./client.ts";
import { createLogger } from "../logger.ts";

const logger = createLogger("apify-youtube");

function readActorId(): string {
  return Deno.env.get("APIFY_YT_ACTOR")?.trim() || "streamers/youtube-scraper";
}

/** Normalized shape every caller in this codebase works with, regardless
 *  of which underlying Apify actor produced the raw item. */
export interface NormalizedVideo {
  videoId: string | null;
  url: string | null;
  title: string;
  description: string;
  channelName: string;
  channelUrl: string | null;
  subscriberCount: number | null;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  isShort: boolean;
}

// deno-lint-ignore no-explicit-any
type RawItem = Record<string, any>;

function firstDefined<T>(...values: (T | undefined | null)[]): T | null {
  for (const v of values) {
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeVideoItem(item: RawItem): NormalizedVideo {
  const title = firstDefined<string>(item.title, item.text, item.videoTitle) ?? "";
  const channelName =
    firstDefined<string>(item.channelName, item.channelTitle, item.channel?.name, item.author) ??
    "";

  return {
    videoId: firstDefined<string>(item.id, item.videoId),
    url: firstDefined<string>(item.url, item.videoUrl),
    title,
    description: firstDefined<string>(item.description, item.text) ?? "",
    channelName,
    channelUrl: firstDefined<string>(item.channelUrl, item.channel?.url),
    subscriberCount: toNumber(
      firstDefined(item.numberOfSubscribers, item.subscriberCount, item.channel?.subscriberCount),
    ),
    viewCount: toNumber(firstDefined(item.viewCount, item.views)) ?? 0,
    likeCount: toNumber(firstDefined(item.likes, item.likeCount)),
    commentCount: toNumber(firstDefined(item.commentsCount, item.commentCount)),
    durationSeconds: toNumber(firstDefined(item.durationSeconds, item.duration)),
    publishedAt: firstDefined<string>(item.publishedAt, item.date, item.uploadDate),
    thumbnailUrl: firstDefined<string>(
      item.thumbnailUrl,
      item.thumbnail,
      Array.isArray(item.thumbnails) ? item.thumbnails[item.thumbnails.length - 1]?.url : null,
    ),
    isShort: Boolean(item.isShort ?? item.isShorts ?? false),
  };
}

/** Runs a keyword search and returns normalized video results.
 *  Used by the Research Engine for niche/keyword input and by the Trend
 *  Engine for tracking a keyword over time. */
export async function searchYouTubeVideos(
  query: string,
  maxResults = 25,
): Promise<NormalizedVideo[]> {
  const actorId = readActorId();
  const items = await runApifyActor<RawItem>(actorId, {
    searchQueries: [query],
    maxResults,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  });
  logger.info("Keyword search complete", { query, resultCount: items.length });
  return items.map(normalizeVideoItem);
}

/** Scrapes a channel's recent videos by channel URL or handle
 *  (e.g. "https://www.youtube.com/@MrBeast" or "@MrBeast"). Used by the
 *  Research Engine (channel input) and Competitor Intelligence. */
export async function fetchChannelVideos(
  channelUrlOrHandle: string,
  maxResults = 25,
): Promise<NormalizedVideo[]> {
  const actorId = readActorId();
  // Ensure we have a full URL
  const url = channelUrlOrHandle.startsWith("http")
    ? channelUrlOrHandle
    : `https://www.youtube.com/${channelUrlOrHandle.replace(/^@?/, "@")}`;

  // ✅ FIX: startUrls must be an array of objects, each with a "url" property
  const items = await runApifyActor<RawItem>(actorId, {
    startUrls: [{ url }],
    maxResults,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  });
  logger.info("Channel scrape complete", { channelUrlOrHandle, resultCount: items.length });
  return items.map(normalizeVideoItem);
}

/** Convenience aggregate used by ResearchService: derives simple
 *  channel-level stats from a list of that channel's normalized videos,
 *  since the scraper actor returns per-video rows rather than a single
 *  channel summary object. */
export function summarizeChannel(videos: NormalizedVideo[]) {
  const count = videos.length || 1;
  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
  const subscriberCount = videos.find((v) => v.subscriberCount != null)?.subscriberCount ?? null;

  return {
    videoCount: videos.length,
    averageViews: Math.round(totalViews / count),
    subscriberCount,
    topVideo: [...videos].sort((a, b) => b.viewCount - a.viewCount)[0] ?? null,
  };
}