import { Component, computed, input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { LucideAngularModule, Zap, TrendingUp, CheckCircle2 } from 'lucide-angular';

@Component({
  selector: 'app-priority-recommendation',
  imports: [LucideAngularModule],
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

  readonly icons = {
    zap: Zap,
    trendingUp: TrendingUp,
    check: CheckCircle2,
  };

  readonly topRec = computed(() => {
    const recs = this.report().recommendations ?? [];
    return recs.find(r => r.priority === 'high') ?? recs[0] ?? null;
  });

  // When the backend says no changes are worth making, this is not "nothing
  // to show" — it's a confident, positive verdict and should read as one.
  readonly showPublishAsIs = computed(
    () => this.report().changes_recommended === false,
  );

  readonly whyItWorks = computed(() => this.report().why_it_works ?? '');
}