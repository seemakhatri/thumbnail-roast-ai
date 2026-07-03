import { ThumbnailReport } from '../models/report.model';

export interface MetricConfig {
  key: keyof Pick<
    ThumbnailReport,
    | 'ctr_score'
    | 'readability_score'
    | 'emotion_score'
    | 'curiosity_score'
    | 'mobile_score'
    | 'contrast_score'
    | 'face_score'
    | 'brand_score'
  >;
  label: string;
}

export const METRICS: MetricConfig[] = [
  { key: 'ctr_score', label: 'CTR Potential' },
  { key: 'readability_score', label: 'Readability' },
  { key: 'emotion_score', label: 'Emotion Signal' },
  { key: 'curiosity_score', label: 'Curiosity Gap' },
  { key: 'mobile_score', label: 'Mobile Visibility' },
  { key: 'contrast_score', label: 'Contrast Score' },
  { key: 'face_score', label: 'Face Impact' },
  { key: 'brand_score', label: 'Brand Consistency' },
];

export interface VerdictDisplay {
  label: string;
  emoji: string;
  badgeClass: string;
}

const VERDICT_MAP: Record<string, VerdictDisplay> = {
  needs_work: {
    label: 'Needs Work',
    emoji: '🔧',
    badgeClass: 'verdict-badge verdict-badge--red',
  },
  decent: {
    label: 'Decent',
    emoji: '👍',
    badgeClass: 'verdict-badge verdict-badge--yellow',
  },
  strong: {
    label: 'Strong Performer',
    emoji: '⚡',
    badgeClass: 'verdict-badge verdict-badge--yellow',
  },
  excellent: {
    label: 'Excellent',
    emoji: '🏆',
    badgeClass: 'verdict-badge verdict-badge--green',
  },
};

export function getVerdictDisplay(verdict: string): VerdictDisplay {
  return VERDICT_MAP[verdict] ?? {
    label: verdict.replace(/_/g, ' '),
    emoji: '📊',
    badgeClass: 'verdict-badge',
  };
}

export function getScoreRingOffset(score: number, radius = 36): number {
  const circumference = 2 * Math.PI * radius;
  return circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
}

export function getScoreRingDashArray(radius = 36): number {
  return 2 * Math.PI * radius;
}

export interface MetricStyle {
  color: string;
  gradient: string;
}

export function getMetricStyle(score: number): MetricStyle {
  if (score >= 80) {
    return { color: '#22c55e', gradient: 'linear-gradient(90deg,#16a34a,#22c55e)' };
  }
  if (score >= 60) {
    return { color: '#eab308', gradient: 'linear-gradient(90deg,#ca8a04,#eab308)' };
  }
  return { color: '#ef4444', gradient: 'linear-gradient(90deg,#dc2626,#ef4444)' };
}

export function priorityClass(priority: string): string {
  if (priority === 'high') return 'high';
  if (priority === 'medium') return 'med';
  return 'low';
}

export function priorityLabel(priority: string): string {
  if (priority === 'high') return 'High';
  if (priority === 'medium') return 'Med';
  return 'Low';
}

export function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}