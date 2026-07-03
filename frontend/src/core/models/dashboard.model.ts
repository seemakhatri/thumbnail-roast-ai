// models/dashboard.model.ts  — CREATE THIS FILE

import { ThumbnailReport } from "./report.model";

export interface DashboardStats {
  avg_score_30d:   number;
  avg_score_prev:  number;   // previous 30 days
  best_score:      number;
  total_analyses:  number;
  weakest_metric:  string;   // e.g. "emotion"
  trend: Array<{
    week: string;
    avg:  number;
  }>;
}

export interface NicheBenchmark {
  niche:       string;
  avg_score:   number;
  p90_score:   number;   // top 10% threshold
  sample_size: number;
}

export interface DashboardData {
  stats:      DashboardStats;
  recent:     ThumbnailReport[];   // last 10 reports
  benchmarks: NicheBenchmark[];
}

export interface ComparisonResponse {
  thumbnails: ThumbnailReport[];
  winner:     string;   // UUID of winning report
}

export interface CtrPair {
  title:        string;
  actual_ctr:   number;
  thumbnail_url: string;
  published_at: string;
  reports: {
    overall_score:    number;
    face_score:       number;
    emotion_score:    number;
    curiosity_score:  number;
    readability_score: number;
    share_slug:       string;
  };
}

export interface CtrCorrelationResponse {
  pairs: CtrPair[];
  insight: {
    avg_score_high_ctr: number | null;
    avg_score_low_ctr:  number | null;
    message:            string | null;
  };
}