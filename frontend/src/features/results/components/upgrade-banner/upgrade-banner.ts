import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Lock, Check, Sparkles, Crown, TrendingUp, BarChart3, Target, Rocket } from 'lucide-angular';

@Component({
  selector: 'app-upgrade-banner',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './upgrade-banner.html',
  styleUrl: './upgrade-banner.scss',
})
export class UpgradeBanner {
  readonly icons = {
    lock: Lock,
    check: Check,
    sparkles: Sparkles,
    crown: Crown,
    trendingUp: TrendingUp,
    barChart: BarChart3,
    target: Target,
    rocket: Rocket,
  };

  readonly lockedFeatures = [
    { icon: this.icons.trendingUp, label: 'A/B Thumbnail Comparison', desc: 'Compare two thumbnails head-to-head' },
    { icon: this.icons.barChart, label: 'Score Trend Tracking', desc: 'Watch your CTR score improve over time' },
    { icon: this.icons.target, label: 'Niche Competitor Benchmarks', desc: 'See how you rank in your niche' },
  ];

  readonly features = [
    '50 analyses per month',
    'A/B comparison mode',
    'Trend & history dashboard',
    'Priority AI processing',
    'CSV export',
  ];
}