import { Component, computed, input } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { ScoreRing } from '../../../../shared/components/score-ring/score-ring';

interface MetricDef {
  key: keyof ThumbnailReport;
  label: string;
}

const METRICS: MetricDef[] = [
  { key: 'ctr_score',         label: 'CTR Potential'  },
  { key: 'readability_score', label: 'Readability'    },
  { key: 'emotion_score',     label: 'Emotion'        },
  { key: 'curiosity_score',   label: 'Curiosity'      },
  { key: 'mobile_score',      label: 'Mobile'         },
  { key: 'contrast_score',    label: 'Contrast'       },
  { key: 'face_score',        label: 'Face Quality'   },
  { key: 'brand_score',       label: 'Branding'       },
];

const VERDICT_MAP: Record<string, { label: string; emoji: string; css: string }> = {
  needs_work: { label: 'Needs Work',  emoji: '⚠️',  css: 'verdict--red'    },
  decent:     { label: 'Decent',      emoji: '📊',  css: 'verdict--yellow' },
  good:       { label: 'Good',        emoji: '👍',  css: 'verdict--blue'   },
  strong:     { label: 'Strong',      emoji: '🔥',  css: 'verdict--orange' },
  excellent:  { label: 'Excellent',   emoji: '🏆',  css: 'verdict--green'  },
};

@Component({
  selector: 'app-score-overview',
  imports: [ScoreRing, DatePipe, NgClass],
  templateUrl: './score-overview.html',
  styleUrl: './score-overview.scss',
})
export class ScoreOverview {
  readonly report = input.required<ThumbnailReport>();

  readonly metrics = METRICS;

  readonly verdictData = computed(() => {
    const v = this.report().verdict ?? 'decent';
    return VERDICT_MAP[v] ?? VERDICT_MAP['decent'];
  });

  verdictLabel()   { return this.verdictData().label; }
  verdictEmoji()   { return this.verdictData().emoji; }
  verdictCss()     { return this.verdictData().css;   }

  getScore(key: keyof ThumbnailReport): number {
    return (this.report()[key] as number) ?? 0;
  }

  scoreColor(score: number): string {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#eab308';
    return '#ef4444';
  }

  scoreGradient(score: number): string {
    if (score >= 70) return 'linear-gradient(90deg, #22c55e, #4ade80)';
    if (score >= 50) return 'linear-gradient(90deg, #eab308, #facc15)';
    return 'linear-gradient(90deg, #ef4444, #f87171)';
  }
}