import { Component, computed, inject, input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { ThumbnailReport } from '../../../core/models/report.model';
import { Supabase } from '../../../core/services/supabase';
import { ShareActions }            from '../../../features/results/components/share-actions/share-actions';
import { ReportHeroCard }          from '../../../features/results/components/report-hero-card/report-hero-card';
import { PriorityRecommendation }  from '../../../features/results/components/priority-recommendation/priority-recommendation';
import { MetricsGrid }             from '../../../features/results/components/metrics-grid/metrics-grid';
import { RoastCard }               from '../../../features/results/components/roast-card/roast-card';
import { StrengthWeaknessGrid }    from '../../../features/results/components/strength-weakness-grid/strength-weakness-grid';
import { RecommendationsTimeline } from '../../../features/results/components/recommendations-timeline/recommendations-timeline';
import { CompetitorInsights }      from '../../../features/results/components/competitor-insights/competitor-insights';
import { UpgradeBanner }           from '../../../features/results/components/upgrade-banner/upgrade-banner';

@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [
    ShareActions,
    ReportHeroCard,
    PriorityRecommendation,
    MetricsGrid,
    RoastCard,
    StrengthWeaknessGrid,
    RecommendationsTimeline,
    CompetitorInsights,
    UpgradeBanner,
  ],
  templateUrl: './report-view.html',
  styleUrl: './report-view.scss',
  animations: [
    trigger('pageEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class ReportView {
  readonly report   = input.required<ThumbnailReport>();
  readonly showTabs = input(true);

  private readonly supabase = inject(Supabase);

  readonly showUpgradeBanner = computed(() => {
    const plan = this.supabase.userPlan();
    return plan === 'free';
  });

  

  
}