import { Component, input } from '@angular/core';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { LucideAngularModule, TrendingUp, Eye, Smile, HelpCircle, Smartphone, Palette, Star, LayoutGrid, Sparkles, PaintBucket } from 'lucide-angular';

interface MetricDef { key: keyof ThumbnailReport; label: string; icon: any; }

const METRICS: MetricDef[] = [
  { key: 'ctr_score',           label: 'CTR Potential',   icon: TrendingUp },
  { key: 'readability_score',   label: 'Readability',     icon: Eye },
  { key: 'emotion_score',       label: 'Emotion',         icon: Smile },
  { key: 'curiosity_score',     label: 'Curiosity',       icon: HelpCircle },
  { key: 'mobile_score',        label: 'Mobile',          icon: Smartphone },
  { key: 'contrast_score',      label: 'Contrast',        icon: Palette },
  { key: 'composition_score',   label: 'Composition',     icon: LayoutGrid },
  { key: 'color_score',         label: 'Color',           icon: PaintBucket },
  { key: 'visual_appeal_score', label: 'Visual Appeal',   icon: Sparkles },
  { key: 'face_score',          label: 'Face Quality',    icon: Smile },
  { key: 'brand_score',         label: 'Branding',        icon: Star },
];

@Component({
  selector: 'app-metrics-grid',
  imports: [LucideAngularModule],
  templateUrl: './metrics-grid.html',
  styleUrl: './metrics-grid.scss',
})
export class MetricsGrid {
  readonly report = input.required<ThumbnailReport>();
  readonly metrics = METRICS;

  getScore(key: keyof ThumbnailReport): number {
    return (this.report()[key] as number) ?? 0;
  }

  scoreColor(s: number): string {
    if (s >= 70) return 'var(--green)';
    if (s >= 50) return 'var(--yellow)';
    return 'var(--red)';
  }
}