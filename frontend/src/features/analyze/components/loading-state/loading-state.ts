import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  imports: [],
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.scss',
})
export class LoadingState {
  readonly progress = input(0);
  readonly status = input('');
  readonly imageUrl = input<string | null>(null);

  readonly statusItems = [
    { label: 'Checking visual hierarchy and layout', minProgress: 0 },
    { label: 'Measuring text contrast and readability', minProgress: 15 },
    { label: 'Detecting face size and emotion signal…', minProgress: 30 },
    { label: 'Benchmarking against top creators in your niche', minProgress: 50 },
    { label: 'Calculating curiosity gap score', minProgress: 70 },
    { label: 'Composing your roast…', minProgress: 85 },
  ];

  readonly activeIndex = computed(() => {
    const p = this.progress();
    let idx = 0;
    for (let i = 0; i < this.statusItems.length; i++) {
      if (p >= this.statusItems[i].minProgress) idx = i;
    }
    return idx;
  });
}
