// upgrade-banner.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-upgrade-banner',
  imports: [RouterLink],
  templateUrl: './upgrade-banner.html',
  styleUrl: './upgrade-banner.scss',
})
export class UpgradeBanner {
  readonly lockedFeatures = [
    { icon: '📊', label: 'A/B Thumbnail Comparison',    desc: 'Compare two thumbnails head-to-head' },
    { icon: '📈', label: 'Score Trend Tracking',        desc: 'Watch your CTR score improve over time' },
    { icon: '🎯', label: 'Niche Competitor Benchmarks', desc: 'See how you rank in your niche' },
  ];

  readonly features = [
    '50 analyses per month',
    'A/B comparison mode',
    'Trend & history dashboard',
    'Priority AI processing',
    'CSV export',
  ];
}