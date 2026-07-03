// metrics-grid.ts
import { Component, input } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';

interface MetricDef { key: keyof ThumbnailReport; label: string; icon: string; }

const METRICS: MetricDef[] = [
  { key: 'ctr_score',          label: 'CTR Potential',  icon: '📈' },
  { key: 'readability_score',  label: 'Readability',    icon: '👁️' },
  { key: 'emotion_score',      label: 'Emotion',        icon: '😮' },
  { key: 'curiosity_score',    label: 'Curiosity',      icon: '🤔' },
  { key: 'mobile_score',       label: 'Mobile',         icon: '📱' },
  { key: 'contrast_score',     label: 'Contrast',       icon: '🎨' },
  { key: 'face_score',         label: 'Face Quality',   icon: '😄' },
  { key: 'brand_score',        label: 'Branding',       icon: '⭐' },
];

@Component({
  selector: 'app-metrics-grid',
  imports: [],
  templateUrl: './metrics-grid.html',
  styleUrl: './metrics-grid.scss',
  animations: [
    trigger('stagger', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class MetricsGrid {
  readonly report = input.required<ThumbnailReport>();
  readonly metrics = METRICS;

  getScore(key: keyof ThumbnailReport): number {
    return (this.report()[key] as number) ?? 0;
  }

  scoreColor(s: number): string {
    if (s >= 70) return '#22c55e';
    if (s >= 50) return '#eab308';
    return '#ef4444';
  }

  barGradient(s: number): string {
    if (s >= 70) return 'linear-gradient(90deg, #22c55e, #4ade80)';
    if (s >= 50) return 'linear-gradient(90deg, #eab308, #facc15)';
    return 'linear-gradient(90deg, #ef4444, #f87171)';
  }

  statusLabel(s: number): string {
    if (s >= 80) return 'Excellent';
    if (s >= 65) return 'Good';
    if (s >= 50) return 'Average';
    if (s >= 35) return 'Weak';
    return 'Poor';
  }

  statusClass(s: number): string {
    if (s >= 70) return 'status--green';
    if (s >= 50) return 'status--yellow';
    return 'status--red';
  }
}