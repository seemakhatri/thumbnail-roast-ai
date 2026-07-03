import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-usage-overview',
  imports: [],
  templateUrl: './usage-overview.html',
  styleUrl: './usage-overview.scss',
})
export class UsageOverview {
  readonly used = input(0);
  readonly limit = input(3);
  readonly plan = input<'free' | 'creator' | 'agency'>('free');

  readonly percent = computed(() => {
    const limit = this.limit();
    if (limit <= 0) return 0;
    return Math.min(100, Math.round((this.used() / limit) * 100));
  });

  readonly remaining = computed(() => Math.max(0, this.limit() - this.used()));
}
