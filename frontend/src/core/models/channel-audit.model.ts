// models/channel-audit.model.ts
//
// Mirrors ChannelAuditReport in
// supabase/functions/_shared/channel-audit-service.ts. Keep in sync.

export interface VideoSummary {
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  views: number;
  overall_score: number | null;
  published_at: string | null;
}

export type TrendDirection = 'improving' | 'declining' | 'stable' | 'not_enough_data';
export type ConsistencyLabel = 'Very Consistent' | 'Consistent' | 'Irregular' | 'Not enough data';

export interface ChannelAudit {
  id: string;
  created_at: string;
  was_cached: boolean;

  overall_channel_score: number;
  score_breakdown: {
    thumbnail_quality: number;
    consistency: number;
    branding: number;
    title_strength: number;
  };

  thumbnail_quality_trend: {
    direction: TrendDirection;
    recent_avg: number | null;
    previous_avg: number | null;
    timeline: Array<{ date: string; score: number }>;
  };

  upload_consistency: {
    label: ConsistencyLabel;
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

export interface ChannelAuditResponse {
  success: boolean;
  audit: ChannelAudit;
}