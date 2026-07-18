import { Component, computed, input } from '@angular/core';

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

  readonly dashArray = computed(() => 2 * Math.PI * this.radius());
  readonly dashOffset = computed(() => {
    const percent = Math.min(100, Math.max(0, this.score()));
    return this.dashArray() * (1 - percent / 100);
  });
  readonly center = computed(() => this.size() / 2);
}