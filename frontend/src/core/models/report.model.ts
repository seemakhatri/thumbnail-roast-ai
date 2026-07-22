// core/models/report.model.ts (or wherever ThumbnailReport is defined)

import { ThumbnailAnalysis } from './analysis.model';

export class ThumbnailReport {
  id!: string;
  user_id!: string | null;
  image_url!: string;
  share_slug!: string;
  overall_score!: number;
  verdict!: string;
  tier?: 'elite' | 'strong' | 'average' | 'weak';
  changes_recommended?: boolean;
  why_it_works?: string;
  roast_title!: string;
  roast!: string;
  niche?: string;
  ctr_score!: number;
  readability_score!: number;
  emotion_score!: number;
  curiosity_score!: number;
  mobile_score!: number;
  contrast_score!: number;
  composition_score!: number;
  face_score!: number;
  brand_score!: number;
  color_score!: number;
  visual_appeal_score!: number;
  strengths!: string[];
  weaknesses!: string[];
  recommendations!: ThumbnailAnalysis['recommendations'];
  competitor_insights!: string[];
  thumbnail_style?: string;
  face_present?: boolean;
  text_present?: boolean;
  text_count?: number;
  has_arrow?: boolean;
  has_circle?: boolean;
  created_at!: string;

  // ─── NEW FIELDS from backend ──────────────────────────────────────────
  publish_decision!: 'publish' | 'publish_after_minor_changes' | 'rework';
  executive_summary!: string;

  // Alias for template convenience
  get score(): number {
    return this.overall_score;
  }

  constructor(partial?: Partial<ThumbnailReport>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}