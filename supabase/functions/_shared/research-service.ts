// _shared/research-service.ts
//
// Business Layer: Research Engine. Takes a creator's channel / niche /
// keyword input, pulls raw YouTube data via the Apify data layer
// (_shared/apify/youtube.ts), and turns it into AI-generated insights
// via the existing provider abstraction (_shared/providers/index.ts —
// the same getAIProvider() used by ai-analyzer.ts). Raw scraped data
// never leaves this file: callers (the research edge function) only
// ever see the insights object below, per the "never expose raw
// scraped data directly" requirement.

import { getAIProvider } from "./providers/index.ts";
import { apifyCircuitBreaker } from "./circuit-breaker.ts";
import { createLogger } from "./logger.ts";
import { capList, extractJsonObject } from "./json-utils.ts";
import {
  fetchChannelVideos,
  NormalizedVideo,
  searchYouTubeVideos,
  summarizeChannel,
} from "./apify/youtube.ts";

const logger = createLogger("research-service");

export type ResearchMode = "channel" | "niche" | "keyword";

export interface ResearchInsights {
  mode: ResearchMode;
  input: string;
  trending_topics: string[];
  search_volume_signal: "low" | "medium" | "high";
  competition_level: "low" | "medium" | "high";
  upload_frequency_note: string;
  average_views: number;
  thumbnail_styles: string[];
  title_patterns: string[];
  audience_interests: string[];
  comment_themes: string[];
  content_gaps: string[];
  summary: string;
  data_points_analyzed: number;
}

const MAX_LIST_LEN = 8;

function buildPrompt(mode: ResearchMode, input: string, videos: NormalizedVideo[]): string {
  const sample = videos.slice(0, 20).map((v) => ({
    title: v.title,
    channel: v.channelName,
    views: v.viewCount,
    likes: v.likeCount,
    comments: v.commentCount,
    published_at: v.publishedAt,
    duration_seconds: v.durationSeconds,
  }));

  return `You are a YouTube growth strategist analyzing real video data for a creator.

Research mode: ${mode}
Creator's input: "${input}"

Here is a sample of ${sample.length} real YouTube videos related to this input (JSON):
${JSON.stringify(sample)}

Based ONLY on this data, return ONLY a JSON object (no markdown, no explanation) with this exact shape:
{
  "trending_topics": ["short topic phrase", ...] (max ${MAX_LIST_LEN}),
  "search_volume_signal": "low" | "medium" | "high",
  "competition_level": "low" | "medium" | "high",
  "upload_frequency_note": "one sentence describing how often top channels in this data upload",
  "thumbnail_styles": ["short style description", ...] (max ${MAX_LIST_LEN}),
  "title_patterns": ["short pattern description", ...] (max ${MAX_LIST_LEN}),
  "audience_interests": ["short interest phrase", ...] (max ${MAX_LIST_LEN}),
  "comment_themes": ["short theme phrase, inferred from titles/engagement since raw comments are not provided", ...] (max ${MAX_LIST_LEN}),
  "content_gaps": ["short content gap opportunity", ...] (max ${MAX_LIST_LEN}),
  "summary": "2-3 sentence plain-language summary of the opportunity for this creator"
}

Be specific and grounded in the data above. Do not invent statistics you cannot infer from it.`;
}

async function generateInsights(
  mode: ResearchMode,
  input: string,
  videos: NormalizedVideo[],
): Promise<Omit<ResearchInsights, "mode" | "input" | "average_views" | "data_points_analyzed">> {
  const provider = getAIProvider();
  const prompt = buildPrompt(mode, input, videos);

  const text = await provider.generate({
    prompt,
    images: [],
    temperature: 0.3,
    maxOutputTokens: 2048,
  });

  if (!text) throw new Error(`${provider.name} returned empty response for research insights`);

  const parsed = extractJsonObject<Record<string, unknown>>(text);

  return {
    trending_topics: capList(parsed.trending_topics as string[], MAX_LIST_LEN),
    search_volume_signal: (["low", "medium", "high"].includes(
        parsed.search_volume_signal as string,
      )
      ? parsed.search_volume_signal
      : "medium") as "low" | "medium" | "high",
    competition_level: (["low", "medium", "high"].includes(parsed.competition_level as string)
      ? parsed.competition_level
      : "medium") as "low" | "medium" | "high",
    upload_frequency_note: (parsed.upload_frequency_note as string) ?? "",
    thumbnail_styles: capList(parsed.thumbnail_styles as string[], MAX_LIST_LEN),
    title_patterns: capList(parsed.title_patterns as string[], MAX_LIST_LEN),
    audience_interests: capList(parsed.audience_interests as string[], MAX_LIST_LEN),
    comment_themes: capList(parsed.comment_themes as string[], MAX_LIST_LEN),
    content_gaps: capList(parsed.content_gaps as string[], MAX_LIST_LEN),
    summary: (parsed.summary as string) ?? "",
  };
}

/** Runs a full Research Engine pass: collect data via Apify, then
 *  summarize it into AI insights. Throws ApifyError / ProviderError
 *  subclasses on failure — callers (the edge function) decide how to
 *  map those to HTTP responses. */
export async function runResearch(
  mode: ResearchMode,
  input: string,
): Promise<ResearchInsights> {
  logger.info("Starting research run", { mode, input });

  const videos = await apifyCircuitBreaker.execute(() => {
    if (mode === "channel") return fetchChannelVideos(input, 25);
    // "niche" and "keyword" both resolve to a keyword search — the
    // distinction matters for prompt framing, not data collection.
    return searchYouTubeVideos(input, 25);
  });

  if (videos.length === 0) {
    throw new Error("No YouTube data found for this input. Try a different channel, niche, or keyword.");
  }

  const { averageViews } = summarizeChannel(videos);
  const insights = await generateInsights(mode, input, videos);

  logger.info("Research run complete", { mode, input, videoCount: videos.length });

  return {
    mode,
    input,
    ...insights,
    average_views: averageViews,
    data_points_analyzed: videos.length,
  };
}
