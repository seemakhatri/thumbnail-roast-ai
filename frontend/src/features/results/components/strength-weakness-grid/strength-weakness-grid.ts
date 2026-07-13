import { Component, input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { LucideAngularModule, CheckCircle, AlertCircle, Check, X } from 'lucide-angular';

@Component({
  selector: 'app-strength-weakness-grid',
  imports: [LucideAngularModule],
  templateUrl: './strength-weakness-grid.html',
  styleUrl: './strength-weakness-grid.scss',
  animations: [
    trigger('fadeLeft', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-16px)' }),
        animate('380ms 100ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
    trigger('fadeRight', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(16px)' }),
        animate('380ms 180ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
  ],
})
export class StrengthWeaknessGrid {
  readonly report = input.required<ThumbnailReport>();

  readonly icons = {
    checkCircle: CheckCircle,
    alertCircle: AlertCircle,
    check: Check,
    x: X,
  };
}