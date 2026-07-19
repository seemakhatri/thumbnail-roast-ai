export type ResearchMode = 'channel' | 'niche' | 'keyword';
export type SignalLevel = 'low' | 'medium' | 'high';

export class ResearchInsights {
  mode!: ResearchMode;
  input!: string;
  trending_topics!: string[];
  search_volume_signal!: SignalLevel;
  competition_level!: SignalLevel;
  upload_frequency_note!: string;
  average_views!: number;
  thumbnail_styles!: string[];
  title_patterns!: string[];
  audience_interests!: string[];
  comment_themes!: string[];
  content_gaps!: string[];
  summary!: string;
  data_points_analyzed!: number;
}

export class ResearchSession {
  id!: string;
  mode!: ResearchMode;
  input!: string;
  insights!: ResearchInsights;
}

export interface ResearchResponse {
  success: boolean;
  session: ResearchSession;
}
