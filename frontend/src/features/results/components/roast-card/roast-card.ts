// roast-card.ts
import { Component, input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';

@Component({
  selector: 'app-roast-card',
  imports: [],
  templateUrl: './roast-card.html',
  styleUrl: './roast-card.scss',
  animations: [
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('340ms 80ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class RoastCard {
  readonly report = input.required<ThumbnailReport>();
}