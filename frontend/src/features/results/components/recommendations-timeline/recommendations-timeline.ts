import { Component, input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { LucideAngularModule, Circle, TrendingUp } from 'lucide-angular';

@Component({
  selector: 'app-recommendations-timeline',
  imports: [LucideAngularModule],
  templateUrl: './recommendations-timeline.html',
  styleUrl: './recommendations-timeline.scss',
  animations: [
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(14px)' }),
        animate('360ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class RecommendationsTimeline {
  readonly report = input.required<ThumbnailReport>();

  readonly icons = {
    circle: Circle,
    trendingUp: TrendingUp,
  };

  priorityLabel(p: string): string {
    const map: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };
    return map[p] ?? p;
  }

  priorityCss(p: string): string {
    const map: Record<string, string> = { high: 'p--red', medium: 'p--yellow', low: 'p--blue' };
    return map[p] ?? '';
  }

  nodeCss(p: string): string {
    const map: Record<string, string> = { high: 'node--red', medium: 'node--yellow', low: 'node--blue' };
    return map[p] ?? '';
  }
}