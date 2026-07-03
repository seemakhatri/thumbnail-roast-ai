export interface AnalysisMetrics {
    ctr_score: number;
    readability_score: number;
    emotion_score: number;
    curiosity_score: number;
     composition_score: number; 
    mobile_score: number;
    contrast_score: number;
    face_score: number;
    brand_score: number;
  }
  
  export interface Recommendation {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: 'visual' | 'text' | 'emotion' | 'composition';
    impact: string;
  }
  
  export type Verdict = 'needs_work' | 'decent' | 'strong' | 'excellent';
  
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
  }
  
  export type AnalysisStep =
    | 'idle'
    | 'uploading'
    | 'analyzing'
    | 'saving'
    | 'complete'
    | 'error';