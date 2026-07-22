import { Component } from '@angular/core';
import {
  Upload,
  Brain,
  TrendingUp,
  Target,
  BarChart3,
  Users,
  Clock,
  Share2,
  LucideAngularModule,
} from 'lucide-angular';

@Component({
  selector: 'app-features-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './features-section.html',
  styleUrl: './features-section.scss',
})
export class FeaturesSection {
  readonly icons = {
    upload: Upload,
    brain: Brain,
    trendingUp: TrendingUp,
    target: Target,
    barChart: BarChart3,
    users: Users,
    clock: Clock,
    share2: Share2,
  };
}