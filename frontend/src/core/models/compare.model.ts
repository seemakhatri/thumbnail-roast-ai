export type CompareLabel = 'A' | 'B' | 'C';

export interface FactorBattle {
  factor: string;
  label: string;
  freshScores: Partial<Record<CompareLabel, number>>;
  blendedScores: Partial<Record<CompareLabel, number>>;
  advantage: CompareLabel | 'tie';
  insight: string;
}

export type PlacementContext =
  | 'mobile_feed'
  | 'suggested_sidebar'
  | 'search_results'
  | 'desktop_home';

export interface PlacementVerdict {
  context: PlacementContext;
  label: string;
  blurb: string;
  winner: CompareLabel | 'tie';
  reason: string;
}

export interface ImprovementStep {
  for: CompareLabel;
  title: string;
  steps: string[];
}

export interface CompareVerdict {
  contenders: CompareLabel[];
  overallWinner: CompareLabel | 'tie';
  confidenceTier: 'clear_winner' | 'close_call' | 'context_dependent';
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