import { Component, computed, input } from '@angular/core';
import { getScoreRingDashArray, getScoreRingOffset } from '../../../core/utils/report.utils';

@Component({
  selector: 'app-score-ring',
  imports: [],
  templateUrl: './score-ring.html',
  styleUrl: './score-ring.scss',
})
export class ScoreRing {
  readonly score = input.required<number>();
  readonly size = input(90);
  readonly radius = input(36);

  readonly dashArray = computed(() => getScoreRingDashArray(this.radius()));
  readonly dashOffset = computed(() => getScoreRingOffset(this.score(), this.radius()));
  readonly center = computed(() => this.size() / 2);
}
