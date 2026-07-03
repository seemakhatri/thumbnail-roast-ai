export interface AnalysisMetrics {
  ctr_score: number;
  readability_score: number;
  emotion_score: number;
  curiosity_score: number;
  mobile_score: number;
  contrast_score: number;
  face_score: number;
  brand_score: number;
  color_score: number;
  visual_appeal_score: number;
  
}

export interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "visual" | "text" | "emotion" | "composition";
  impact: string;
}

export type Verdict = "needs_work" | "decent" | "good" | "strong" | "excellent";

export interface ThumbnailAnalysis {
  overall_score: number;
  verdict: Verdict;
  roast_title: string;
  roast: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: Recommendation[];
  competitor_insights: string[];
  metrics: AnalysisMetrics;
  // Enhanced fields for Phase 3+
  niche?: string;
  thumbnail_style?: string;
  face_present?: boolean;
  text_present?: boolean;
  text_count?: number;
  has_arrow?: boolean;
  has_circle?: boolean;
}

export interface AnalyzeRequest {
  imageUrl: string;
}

export interface ThumbnailReport {
  id: string;
  user_id: string | null;
  guest_ip: string | null;
  image_url: string;
  share_slug: string;
  overall_score: number;
  verdict: Verdict;
  roast_title: string;
  roast: string;
  ctr_score: number;
  readability_score: number;
  emotion_score: number;
  curiosity_score: number;
  mobile_score: number;
  contrast_score: number;
  face_score: number;
  brand_score: number;
  // ── NEW PHASE 4 SIGNALS ──────────────────────────────────────────────
  color_score: number;
  visual_appeal_score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: Recommendation[];
  competitor_insights: string[];
  niche?: string;
  thumbnail_style?: string;
  face_present?: boolean;
  text_present?: boolean;
  text_count?: number;
  has_arrow?: boolean;
  has_circle?: boolean;
  was_cached: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: "free" | "creator" | "agency";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: "inactive" | "active" | "cancelled" | "past_due";
  analyses_used: number;
  analyses_limit: number;
  created_at: string;
  updated_at: string;
}

export interface YouTubeVideo {
  id: string;
  user_id: string;
  youtube_video_id: string;
  thumbnail_url: string;
  title: string;
  views: number;
  impressions: number;
  ctr: number;
  published_at: string;
  report_id?: string;
}

export interface DashboardStats {
  avg_score: number;
  best_score: number;
  total_analyses: number;
  plan: string;
  analyses_used: number;
  analyses_limit: number;
  recent_scores: Array<{ created_at: string; overall_score: number }>;
  niche_ranking?: {
    niche: string;
    user_score: number;
  };
}

export interface CORSHeaders {
  "Access-Control-Allow-Origin": string;
  "Access-Control-Allow-Headers": string;
  "Access-Control-Allow-Methods": string;
}

// ── Request/Response types ──────────────────────────────────────────────────

export interface AnalyzeResponse {
  success: boolean;
  report?: Omit<ThumbnailReport, "user_id" | "guest_ip">;
  error?: string;
}

export interface ReportResponse {
  report: Omit<ThumbnailReport, "user_id" | "guest_ip">;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recent_analyses: Omit<ThumbnailReport, "user_id" | "guest_ip">[];
  niche_benchmarks?: Array<{
    niche: string;
    avg_score: number;
  }>;
}

export interface ComparisonRequest {
  thumbnailA: string; // UUID of report
  thumbnailB: string; // UUID of report
  thumbnailC?: string; // UUID of report (optional 3-way comparison)
}

export interface ComparisonResponse {
  thumbnails: Omit<ThumbnailReport, "user_id" | "guest_ip">[];
  winner?: string; // UUID of winning report
  verdict?: CompareVerdict;
  recurringPattern?: RecurringPattern | null;
}

// ── Compare v2 shapes (mirrors _shared/vision-comparator.ts) ─────────────
export type CompareLabel = "A" | "B" | "C";

export interface FactorBattle {
  factor: string;
  label: string;
  freshScores: Partial<Record<CompareLabel, number>>;
  blendedScores: Partial<Record<CompareLabel, number>>;
  advantage: CompareLabel | "tie";
  insight: string;
}

export interface PlacementVerdict {
  context: "mobile_feed" | "suggested_sidebar" | "search_results" | "desktop_home";
  label: string;
  blurb: string;
  winner: CompareLabel | "tie";
  reason: string;
}

export interface ImprovementStep {
  for: CompareLabel;
  title: string;
  steps: string[];
}

export interface CompareVerdict {
  contenders: CompareLabel[];
  overallWinner: CompareLabel | "tie";
  confidenceTier: "clear_winner" | "close_call" | "context_dependent";
  confidence: number;
  headline: string;
  compositeScores: Partial<Record<CompareLabel, number>>;
  factorBattles: FactorBattle[];
  placementVerdicts: PlacementVerdict[];
  improvementRoadmap: ImprovementStep[];
  swapSuggestion?: string;
  nicheUsed: string;
  discrepancyNotes: string[];
  provider: string;
}

export interface RecurringPattern {
  factor: string;
  lossRate: number;
  sampleSize: number;
  message: string;
}

export interface YouTubeConnectRequest {
  code: string; // OAuth code from Google
  redirectUri: string;
}

export interface YouTubeSyncResponse {
  videos_synced: number;
  total_videos: number;
}