import { Component, input } from '@angular/core';
import { ThumbnailReport } from '../../../../core/models/report.model';

@Component({
  selector: 'app-strengths-card',
  imports: [],
  templateUrl: './strengths-card.html',
  styleUrl: './strengths-card.scss',
})
export class StrengthsCard {
  readonly report = input.required<ThumbnailReport>();
}
