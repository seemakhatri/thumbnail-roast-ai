import { Component, input } from '@angular/core';
import { ThumbnailReport } from '../../../../core/models/report.model';

@Component({
  selector: 'app-competitor-insights-card',
  imports: [],
  templateUrl: './competitor-insights-card.html',
  styleUrl: './competitor-insights-card.scss',
})
export class CompetitorInsightsCard {
  readonly report = input.required<ThumbnailReport>();
}
