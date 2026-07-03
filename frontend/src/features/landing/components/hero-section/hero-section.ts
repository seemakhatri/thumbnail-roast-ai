import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowTrendingUp,
  heroSparkles,
  heroArrowDown,
} from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [NgIcon],
  viewProviders: [
    provideIcons({ heroArrowTrendingUp, heroSparkles, heroArrowDown }),
  ],
  templateUrl: './hero-section.html',
  styleUrl: './hero-section.scss',
})
export class HeroSection {
  readonly avatarInitials = ['A', 'J', 'M', 'S', 'K'];

  scrollToAnalyze(): void {
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
  }

  scrollToHowItWorks(): void {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  }
}