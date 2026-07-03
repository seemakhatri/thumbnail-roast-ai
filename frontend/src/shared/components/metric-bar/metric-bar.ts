import { Component, computed, input } from '@angular/core';
import { getMetricStyle } from '../../../core/utils/report.utils';

@Component({
  selector: 'app-metric-bar',
  imports: [],
  templateUrl: './metric-bar.html',
  styleUrl: './metric-bar.scss',
})
export class MetricBar {
  readonly label = input.required<string>();
  readonly score = input.required<number>();

  readonly style = computed(() => getMetricStyle(this.score()));
}
