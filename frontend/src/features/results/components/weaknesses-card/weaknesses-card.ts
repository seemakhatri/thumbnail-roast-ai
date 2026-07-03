import { Component, input } from '@angular/core';
import { ThumbnailReport } from '../../../../core/models/report.model';

@Component({
  selector: 'app-weaknesses-card',
  imports: [],
  templateUrl: './weaknesses-card.html',
  styleUrl: './weaknesses-card.scss',
})
export class WeaknessesCard {
  readonly report = input.required<ThumbnailReport>();
}
