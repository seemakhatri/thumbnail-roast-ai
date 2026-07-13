import { Component } from '@angular/core';
import { LucideAngularModule, ArrowDown, Flame } from 'lucide-angular';
import { MarqueeItem } from '../../../../shared/components/marquee/marquee';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './hero-section.html',
  styleUrl: './hero-section.scss',
})
export class HeroSection {
  readonly icons = { arrowDown: ArrowDown, flame: Flame };

  readonly avatarInitials = ['A', 'J', 'M', 'S', 'K'];
  readonly liveFeed: MarqueeItem[] = [
    {
      author: 'Alex K.',
      handle: 'Gaming · 340K subs',
      emoji: '🎮',
      message: 'CTR went from 4.1% to 6.8% after fixing what it flagged.',
      reaction: '12',
    },
    {
      author: 'Priya M.',
      handle: 'Food · 82K subs',
      emoji: '🍳',
      message: 'The curiosity gap insight rewired my whole thumbnail strategy.',
      reaction: '8',
    },
    {
      author: 'Marcus W.',
      handle: 'Agency · 12 channels',
      emoji: '📺',
      message: 'Replaced a $1,800/mo junior editor review. Not exaggerating.',
      reaction: '26',
    },
    {
      author: 'Dana R.',
      handle: 'Tech · 19K subs',
      emoji: '💻',
      message: 'Brutal roast, but my worst-scoring thumbnail became my best video.',
      reaction: '5',
    },
    {
      author: 'Kenji T.',
      handle: 'Fitness · 61K subs',
      emoji: '🏋️',
      message: 'Score jumped 34 → 81 in one revision. CTR followed.',
      reaction: '14',
    },
  ];

  scrollToAnalyze(): void {
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
  }

  scrollToHowItWorks(): void {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  }
}
