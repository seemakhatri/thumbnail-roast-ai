import { ThumbnailAnalysis } from './analysis.model';

export class ThumbnailReport {
  id!: string;
  user_id!: string | null;
  image_url!: string;
  share_slug!: string;
  overall_score!: number;
  verdict!: string;
  roast_title!: string;
  roast!: string;
  niche?: string;
  ctr_score!: number;
  readability_score!: number;
  emotion_score!: number;
  curiosity_score!: number;
  mobile_score!: number;
  contrast_score!: number;
  face_score!: number;
  brand_score!: number;
  strengths!: string[];
  weaknesses!: string[];
  recommendations!: ThumbnailAnalysis['recommendations'];
  competitor_insights!: string[];
  created_at!: string;
  
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