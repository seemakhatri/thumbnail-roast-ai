import { Component, input } from '@angular/core';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { priorityClass, priorityLabel } from '../../../../core/utils/report.utils';

@Component({
  selector: 'app-recommendations-card',
  imports: [],
  templateUrl: './recommendations-card.html',
  styleUrl: './recommendations-card.scss',
})
export class RecommendationsCard {
  readonly report = input.required<ThumbnailReport>();

  priorityClass = priorityClass;
  priorityLabel = priorityLabel;
}
