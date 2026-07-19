// _shared/channel-audit-service.ts
//
// Business layer for the AI Channel Audit. Takes a user's already-synced
// YouTube videos (youtube_videos, joined with any linked Thumbnail
// Analysis `reports` rows) and turns them into a full channel health
// report: deterministic stats computed in code (so scores are stable
// and don't drift between identical runs) plus an AI-generated
// narrative layer (strengths/weaknesses, gaps, recommendations, next
// video ideas) via the existing provider abstraction
// (_shared/providers/index.ts — the same getAIProvider() used by
// ai-analyzer.ts and research-service.ts). No new AI provider code,
// no duplicate business logic: this file only combines data that
// youtube-sync and analyze-thumbnail already produced.

import { getAIProvider } from "./providers/index.ts";
import { aiCircuitBreaker } from "./circuit-breaker.ts";
import { createLogger } from "./logger.ts";
import { capList, extractJsonObject } from "./json-utils.ts";

const logger = createLogger("channel-audit-service");

export const MIN_VIDEOS_FOR_AUDIT = 5;

// ─── Input shape (from a youtube_videos ⋈ reports query) ────────────────

export interface ChannelAuditVideoInput {
  youtube_video_id: string;
  title: string | null;
  thumbnail_url: string | null;
  views: number | null;
  published_at: string | null;
  report: {
    overall_score: number;
    niche: string | null;
    thumbnail_style: string | null;
    brand_score: number | null;
    contrast_score: number | null;
    verdict: string | null;
  } | null;
}

// ─── Output shape ────────────────────────────────────────────────────────

export interface VideoSummary {
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  views: number;
  overall_score: number | null;
  published_at: string | null;
}

export interface ChannelAuditReport {
  overall_channel_score: number;
  score_breakdown: {
    thumbnail_quality: number;
    consistency: number;
    branding: number;
    title_strength: number;
  };
  thumbnail_quality_trend: {
    direction: "improving" | "declining" | "stable" | "not_enough_data";
    recent_avg: number | null;
    previous_avg: number | null;
    timeline: Array<{ date: string; score: number }>;
  };
  upload_consistency: {
    label: "Very Consistent" | "Consistent" | "Irregular" | "Not enough data";
    avg_gap_days: number | null;
    longest_gap_days: number | null;
    uploads_per_month: number | null;
  };
  title_pattern_analysis: {
    avg_word_count: number;
    pct_with_numbers: number;
    pct_questions: number;
    pct_power_words: number;
    note: string;
  };
  branding_consistency: {
    score: number;
    note: string;
  };
  best_performing_by_score: VideoSummary[];
  worst_performing_by_score: VideoSummary[];
  best_performing_by_views: VideoSummary[];
  topic_performance: Array<{
    niche: string;
    avg_score: number;
    avg_views: number;
    video_count: number;
  }>;
  content_gaps: string[];
  growth_opportunities: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  next_video_ideas: string[];
  summary: string;
  videos_analyzed_count: number;
  channel_video_count: number;
  data_points_analyzed: number;
}

const POWER_WORDS = [
  "how", "why", "best", "worst", "secret", "never", "truth", "mistake",
  "stop", "need", "before", "after", "vs", "review", "ultimate", "easy",
  "proven", "shocking", "insane", "finally", "honest",
];

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function round(n: number): number {
  return Math.round(n);
}

// ─── Deterministic computations ─────────────────────────────────────────

function computeUploadConsistency(
  sortedByDate: ChannelAuditVideoInput[],
): ChannelAuditReport["upload_consistency"] {
  const dated = sortedByDate.filter((v) => v.published_at);
  if (dated.length < 3) {
    return {
      label: "Not enough data",
      avg_gap_days: null,
      longest_gap_days: null,
      uploads_per_month: null,
    };
  }

  const dates = dated.map((v) => new Date(v.published_at!));
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(daysBetween(dates[i - 1], dates[i]));
  }

  const avgGap = mean(gaps);
  const longestGap = Math.max(...gaps);
  const cv = avgGap > 0 ? stddev(gaps) / avgGap : 0; // coefficient of variation

  const label = cv < 0.4 ? "Very Consistent" : cv < 0.85 ? "Consistent" : "Irregular";

  const spanDays = daysBetween(dates[0], dates[dates.length - 1]) || 1;
  const uploadsPerMonth = (dated.length / spanDays) * 30;

  return {
    label,
    avg_gap_days: round(avgGap),
    longest_gap_days: round(longestGap),
    uploads_per_month: Math.round(uploadsPerMonth * 10) / 10,
  };
}

function computeThumbnailQualityTrend(
  sortedByDate: ChannelAuditVideoInput[],
): ChannelAuditReport["thumbnail_quality_trend"] {
  const analyzed = sortedByDate.filter((v) => v.report && v.published_at);
  if (analyzed.length < 4) {
    return {
      direction: "not_enough_data",
      recent_avg: null,
      previous_avg: null,
      timeline: analyzed.map((v) => ({
        date: v.published_at!,
        score: v.report!.overall_score,
      })),
    };
  }

  const mid = Math.floor(analyzed.length / 2);
  const earlier = analyzed.slice(0, mid);
  const recent = analyzed.slice(mid);

  const earlierAvg = mean(earlier.map((v) => v.report!.overall_score));
  const recentAvg = mean(recent.map((v) => v.report!.overall_score));
  const diff = recentAvg - earlierAvg;

  const direction = diff >= 4 ? "improving" : diff <= -4 ? "declining" : "stable";

  return {
    direction,
    recent_avg: round(recentAvg),
    previous_avg: round(earlierAvg),
    timeline: analyzed.slice(-24).map((v) => ({
      date: v.published_at!,
      score: v.report!.overall_score,
    })),
  };
}

function computeTitlePatternAnalysis(
  videos: ChannelAuditVideoInput[],
): Omit<ChannelAuditReport["title_pattern_analysis"], "note"> {
  const titles = videos.map((v) => v.title ?? "").filter(Boolean);
  if (!titles.length) {
    return { avg_word_count: 0, pct_with_numbers: 0, pct_questions: 0, pct_power_words: 0 };
  }

  const wordCounts = titles.map((t) => t.trim().split(/\s+/).length);
  const withNumbers = titles.filter((t) => /\d/.test(t)).length;
  const questions = titles.filter((t) => t.trim().endsWith("?")).length;
  const withPowerWords = titles.filter((t) => {
    const lower = t.toLowerCase();
    return POWER_WORDS.some((w) => lower.includes(w));
  }).length;

  return {
    avg_word_count: Math.round(mean(wordCounts) * 10) / 10,
    pct_with_numbers: round((withNumbers / titles.length) * 100),
    pct_questions: round((questions / titles.length) * 100),
    pct_power_words: round((withPowerWords / titles.length) * 100),
  };
}

function computeBrandingScore(
  analyzed: ChannelAuditVideoInput[],
): number {
  const brandScores = analyzed
    .map((v) => v.report?.brand_score)
    .filter((s): s is number => typeof s === "number");

  if (!brandScores.length) return 50; // neutral default, not enough signal

  const avgBrand = mean(brandScores);
  const variance = stddev(brandScores);
  const consistencyComponent = Math.max(0, 100 - variance * 4);

  return round(avgBrand * 0.6 + consistencyComponent * 0.4);
}

function toVideoSummary(v: ChannelAuditVideoInput): VideoSummary {
  return {
    youtube_video_id: v.youtube_video_id,
    title: v.title ?? "Untitled",
    thumbnail_url: v.thumbnail_url,
    views: v.views ?? 0,
    overall_score: v.report?.overall_score ?? null,
    published_at: v.published_at,
  };
}

function computeTopicPerformance(
  analyzed: ChannelAuditVideoInput[],
): ChannelAuditReport["topic_performance"] {
  const byNiche = new Map<string, ChannelAuditVideoInput[]>();
  for (const v of analyzed) {
    const niche = v.report?.niche?.trim();
    if (!niche) continue;
    if (!byNiche.has(niche)) byNiche.set(niche, []);
    byNiche.get(niche)!.push(v);
  }

  return Array.from(byNiche.entries())
    .map(([niche, vids]) => ({
      niche,
      avg_score: round(mean(vids.map((v) => v.report!.overall_score))),
      avg_views: round(mean(vids.map((v) => v.views ?? 0))),
      video_count: vids.length,
    }))
    .sort((a, b) => b.avg_score - a.avg_score);
}

function consistencyScoreFromLabel(label: string): number {
  switch (label) {
    case "Very Consistent": return 90;
    case "Consistent": return 68;
    case "Irregular": return 38;
    default: return 50;
  }
}

function titleStrengthScore(
  analysis: Omit<ChannelAuditReport["title_pattern_analysis"], "note">,
): number {
  // Reward variety/hook usage without any single signal dominating.
  const numberScore = Math.min(analysis.pct_with_numbers, 60);
  const powerScore = Math.min(analysis.pct_power_words, 70);
  const lengthScore = analysis.avg_word_count >= 4 && analysis.avg_word_count <= 12 ? 80 : 55;
  return round(numberScore * 0.3 + powerScore * 0.4 + lengthScore * 0.3);
}

// ─── AI narrative layer ──────────────────────────────────────────────────

function buildPrompt(params: {
  videos: ChannelAuditVideoInput[];
  analyzedCount: number;
  uploadConsistency: ChannelAuditReport["upload_consistency"];
  qualityTrend: ChannelAuditReport["thumbnail_quality_trend"];
  titlePatterns: Omit<ChannelAuditReport["title_pattern_analysis"], "note">;
  brandingScore: number;
  topicPerformance: ChannelAuditReport["topic_performance"];
  bestByScore: VideoSummary[];
  worstByScore: VideoSummary[];
}): string {
  const sample = params.videos.slice(0, 30).map((v) => ({
    title: v.title,
    views: v.views,
    published_at: v.published_at,
    overall_score: v.report?.overall_score ?? null,
    niche: v.report?.niche ?? null,
    verdict: v.report?.verdict ?? null,
  }));

  return `You are a senior YouTube channel strategist producing an AI Channel Audit for a creator.

Here is data already computed from their channel (JSON):
- Videos analyzed for thumbnail quality: ${params.analyzedCount}
- Upload consistency: ${JSON.stringify(params.uploadConsistency)}
- Thumbnail quality trend: ${JSON.stringify(params.qualityTrend)}
- Title pattern stats: ${JSON.stringify(params.titlePatterns)}
- Branding consistency score (0-100): ${params.brandingScore}
- Topic/niche performance: ${JSON.stringify(params.topicPerformance)}
- Best performing videos by score: ${JSON.stringify(params.bestByScore.map((v) => v.title))}
- Worst performing videos by score: ${JSON.stringify(params.worstByScore.map((v) => v.title))}

Here is a sample of ${sample.length} of the creator's actual videos (JSON):
${JSON.stringify(sample)}

Based ONLY on this data, return ONLY a JSON object (no markdown, no explanation) with this exact shape:
{
  "strengths": ["short specific strength", ...] (max 6),
  "weaknesses": ["short specific weakness", ...] (max 6),
  "content_gaps": ["short content gap opportunity based on their niche/topics", ...] (max 6),
  "growth_opportunities": ["short growth opportunity", ...] (max 6),
  "recommendations": ["short actionable recommendation", ...] (max 8),
  "next_video_ideas": ["specific video title/concept idea grounded in their patterns", ...] (max 5),
  "branding_note": "1-2 sentences on thumbnail/branding consistency",
  "title_pattern_note": "1-2 sentences describing their title patterns and effectiveness",
  "summary": "2-4 sentence plain-language summary of overall channel health and the single highest-leverage next step"
}

Be specific and grounded in the data above. Do not invent statistics you cannot infer from it.`;
}

interface AINarrative {
  strengths: string[];
  weaknesses: string[];
  content_gaps: string[];
  growth_opportunities: string[];
  recommendations: string[];
  next_video_ideas: string[];
  branding_note: string;
  title_pattern_note: string;
  summary: string;
}

async function generateNarrative(prompt: string): Promise<AINarrative> {
  const provider = getAIProvider();

  const text = await aiCircuitBreaker.execute(() =>
    provider.generate({ prompt, images: [], temperature: 0.4, maxOutputTokens: 2048 })
  );

  if (!text) throw new Error(`${provider.name} returned empty response for channel audit`);

  const parsed = extractJsonObject<Record<string, unknown>>(text);

  return {
    strengths: capList(parsed.strengths as string[], 6),
    weaknesses: capList(parsed.weaknesses as string[], 6),
    content_gaps: capList(parsed.content_gaps as string[], 6),
    growth_opportunities: capList(parsed.growth_opportunities as string[], 6),
    recommendations: capList(parsed.recommendations as string[], 8),
    next_video_ideas: capList(parsed.next_video_ideas as string[], 5),
    branding_note: (parsed.branding_note as string) ?? "",
    title_pattern_note: (parsed.title_pattern_note as string) ?? "",
    summary: (parsed.summary as string) ?? "",
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────

/** Runs a full Channel Audit pass over already-synced YouTube videos.
 *  Throws if there isn't enough data (caller maps that to a 400/422). */
export async function runChannelAudit(
  videos: ChannelAuditVideoInput[],
): Promise<ChannelAuditReport> {
  if (videos.length < MIN_VIDEOS_FOR_AUDIT) {
    throw new Error(
      `Not enough synced videos to run a Channel Audit (need at least ${MIN_VIDEOS_FOR_AUDIT}, have ${videos.length}). Sync more videos from your YouTube account first.`,
    );
  }

  logger.info("Starting channel audit", { videoCount: videos.length });

  const sortedByDate = [...videos].sort((a, b) => {
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return ta - tb;
  });

  const analyzed = videos.filter((v) => v.report);

  const uploadConsistency = computeUploadConsistency(sortedByDate);
  const qualityTrend = computeThumbnailQualityTrend(sortedByDate);
  const titlePatternsRaw = computeTitlePatternAnalysis(videos);
  const brandingScore = computeBrandingScore(analyzed);
  const topicPerformance = computeTopicPerformance(analyzed);

  const byScoreDesc = [...analyzed].sort(
    (a, b) => b.report!.overall_score - a.report!.overall_score,
  );
  const bestByScore = byScoreDesc.slice(0, 5).map(toVideoSummary);
  const worstByScore = byScoreDesc.slice(-5).reverse().map(toVideoSummary);
  const bestByViews = [...videos]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5)
    .map(toVideoSummary);

  const thumbnailQualityScore = analyzed.length
    ? round(mean(analyzed.map((v) => v.report!.overall_score)))
    : 50;
  const titleStrength = titleStrengthScore(titlePatternsRaw);
  const consistencyScore = consistencyScoreFromLabel(uploadConsistency.label);

  const overallChannelScore = round(
    thumbnailQualityScore * 0.35 +
      brandingScore * 0.2 +
      consistencyScore * 0.2 +
      titleStrength * 0.25,
  );

  const prompt = buildPrompt({
    videos: sortedByDate.slice().reverse(),
    analyzedCount: analyzed.length,
    uploadConsistency,
    qualityTrend,
    titlePatterns: titlePatternsRaw,
    brandingScore,
    topicPerformance,
    bestByScore,
    worstByScore,
  });

  const narrative = await generateNarrative(prompt);

  logger.info("Channel audit complete", {
    videoCount: videos.length,
    analyzedCount: analyzed.length,
    overallChannelScore,
  });

  return {
    overall_channel_score: overallChannelScore,
    score_breakdown: {
      thumbnail_quality: thumbnailQualityScore,
      consistency: consistencyScore,
      branding: brandingScore,
      title_strength: titleStrength,
    },
    thumbnail_quality_trend: qualityTrend,
    upload_consistency: uploadConsistency,
    title_pattern_analysis: { ...titlePatternsRaw, note: narrative.title_pattern_note },
    branding_consistency: { score: brandingScore, note: narrative.branding_note },
    best_performing_by_score: bestByScore,
    worst_performing_by_score: worstByScore,
    best_performing_by_views: bestByViews,
    topic_performance: topicPerformance,
    content_gaps: narrative.content_gaps,
    growth_opportunities: narrative.growth_opportunities,
    strengths: narrative.strengths,
    weaknesses: narrative.weaknesses,
    recommendations: narrative.recommendations,
    next_video_ideas: narrative.next_video_ideas,
    summary: narrative.summary,
    videos_analyzed_count: analyzed.length,
    channel_video_count: videos.length,
    data_points_analyzed: videos.length,
  };
}