import { Component } from '@angular/core';
import { LucideAngularModule, ArrowDown, Flame } from 'lucide-angular';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './hero-section.html',
  styleUrl: './hero-section.scss',
})
export class HeroSection {
  readonly icons = { arrowDown: ArrowDown, flame: Flame };

  scrollToAnalyze(): void {
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
  }

  scrollToHowItWorks(): void {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  }
}