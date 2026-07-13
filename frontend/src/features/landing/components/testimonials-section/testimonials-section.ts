import { Component } from '@angular/core';
import { LucideAngularModule, Star } from 'lucide-angular';
import { Marquee, MarqueeItem } from '../../../../shared/components/marquee/marquee';

@Component({
  selector: 'app-testimonials-section',
  standalone: true,
  imports: [LucideAngularModule, Marquee],
  templateUrl: './testimonials-section.html',
  styleUrl: './testimonials-section.scss',
})
export class TestimonialsSection {
  readonly icons = { star: Star };

  readonly stats = [
    { num: '12,400+', label: 'thumbnails roasted' },
    { num: '+31%', label: 'avg CTR lift reported' },
    { num: '4.9/5', label: 'from creators' },
    { num: '< 15s', label: 'time to results' },
  ];

  readonly communityFeed: MarqueeItem[] = [
    {
      author: 'Minnie',
      handle: 'community mod',
      emoji: '🎉',
      message: 'Congrats @Julian — our man is hired! Let\u2019s go!!!',
      reaction: '26',
    },
    {
      author: 'Julian',
      handle: 'full-stack dev',
      emoji: '🚀',
      message:
        'Thanks everyone for the help fixing my resume — really happy to get another win for the community.',
      reaction: '17',
    },
    {
      author: 'Alex K.',
      handle: 'gaming creator',
      emoji: '🎮',
      message:
        'Today I published my first real-world project with an active watchlist site for gamers.',
      reaction: '9',
    },
    {
      author: 'Priya M.',
      handle: 'food creator',
      emoji: '🍳',
      message: 'Small win for me today — I got a job offer!',
      reaction: '14',
    },
    {
      author: 'Marcus W.',
      handle: 'agency lead',
      emoji: '📺',
      message:
        'Officially at a full-time developer role — thanks all for the support along the way.',
      reaction: '11',
    },
  ];

  readonly testimonials = [
    {
      name: 'Alex Kowalski',
      handle: 'Gaming · 340K subscribers',
      emoji: '🎮',
      avatarGradient: 'linear-gradient(135deg, #ff4d00, #a855f7)',
      ctrChange: '4.1% → 6.8%',
      quote:
        'I thought I was decent at thumbnails after 3 years. The roast humbled me — and my CTR went from 4.1% to 6.8% in two weeks just from fixing what it flagged.',
    },
    {
      name: 'Priya Mehta',
      handle: 'Food & Cooking · 82K subscribers',
      emoji: '🍳',
      avatarGradient: 'linear-gradient(135deg, #22c55e, #3b82f6)',
      ctrChange: '2.9% → 5.4%',
      quote:
        'Finally a tool that explains the psychology. The curiosity gap insight alone made me rethink my entire thumbnail strategy. My best video this month came from one fix.',
    },
    {
      name: 'Marcus Webb',
      handle: 'Agency · 12 managed channels',
      emoji: '📺',
      avatarGradient: 'linear-gradient(135deg, #eab308, #ef4444)',
      ctrChange: 'Agency-wide +38%',
      quote:
        'We manage 12 YouTube channels. This replaced a junior editor we were paying $1,800/mo to review thumbnails. The competitor intel feature alone is worth 10x the price.',
    },
  ];
}
