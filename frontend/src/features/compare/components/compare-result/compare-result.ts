import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Trophy,
  Flame,
  Target,
  BarChart3,
  Sparkles,
  Swords,
  Smartphone,
  MonitorPlay,
  SearchCheck,
  Tv,
  Lightbulb,
  History,
  Info,
  ArrowLeftRight,
  ShieldAlert,
  CheckCircle2,
  Share2,
  LucideIconData,
} from 'lucide-angular';
import { ComparisonApiResult } from '../../../../core/services/compare';
import {
  CompareLabel,
  PlacementContext,
} from '../../../../core/models/compare.model';

const PLACEMENT_ICONS: Record<PlacementContext, LucideIconData> = {
  mobile_feed: Smartphone,
  suggested_sidebar: MonitorPlay,
  search_results: SearchCheck,
  desktop_home: Tv,
};

@Component({
  selector: 'app-compare-result',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './compare-result.html',
  styleUrl: './compare-result.scss',
})
export class CompareResult {
  readonly result = input.required<ComparisonApiResult>();

  readonly icons = {
    trophy: Trophy,
    flame: Flame,
    target: Target,
    barChart: BarChart3,
    sparkles: Sparkles,
    swords: Swords,
    lightbulb: Lightbulb,
    history: History,
    info: Info,
    swap: ArrowLeftRight,
    warning: ShieldAlert,
    check: CheckCircle2,
    share: Share2,
  };

  readonly placementIcon = (ctx: PlacementContext) => PLACEMENT_ICONS[ctx];

  readonly verdict = computed(() => this.result().verdict);
  readonly thumbnails = computed(() => this.result().thumbnails);

  readonly confidenceLabel = computed(() => {
    switch (this.verdict().confidenceTier) {
      case 'clear_winner':
        return 'Clear winner';
      case 'close_call':
        return 'Close call';
      default:
        return 'Context-dependent';
    }
  });

  readonly labelColors: Record<CompareLabel, string> = {
    A: 'var(--accent2)',
    B: '#4f9dff',
    C: '#22c55e',
  };

  thumbFor(label: CompareLabel) {
    return this.thumbnails().find((t) => t.label === label);
  }

  scoreFor(label: CompareLabel): number {
    return this.verdict().compositeScores[label] ?? 0;
  }

  isOverallWinner(label: CompareLabel): boolean {
    return this.verdict().overallWinner === label;
  }

  barWidth(score: number): string {
    return `${Math.max(4, score)}%`;
  }
}