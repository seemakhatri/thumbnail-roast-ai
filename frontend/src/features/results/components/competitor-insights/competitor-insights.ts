import { Component, input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { LucideAngularModule, Target, ArrowRight } from 'lucide-angular';

@Component({
  selector: 'app-competitor-insights',
  imports: [LucideAngularModule],
  templateUrl: './competitor-insights.html',
  styleUrl: './competitor-insights.scss',
  animations: [
    trigger('stagger', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('320ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class CompetitorInsights {
  readonly report = input.required<ThumbnailReport>();

  readonly icons = {
    target: Target,
    arrowRight: ArrowRight,
  };
}