// priority-recommendation.ts
import { Component, computed, input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';

@Component({
  selector: 'app-priority-recommendation',
  imports: [],
  templateUrl: './priority-recommendation.html',
  styleUrl: './priority-recommendation.scss',
  animations: [
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(14px)' }),
        animate('380ms 120ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class PriorityRecommendation {
  readonly report = input.required<ThumbnailReport>();

  readonly topRec = computed(() => {
    const recs = this.report().recommendations ?? [];
    return recs.find(r => r.priority === 'high') ?? recs[0] ?? null;
  });
}