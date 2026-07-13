import { Component, Input } from '@angular/core';
import { LucideAngularModule, LucideIconData, Flame } from 'lucide-angular';

export interface MarqueeItem {
  author: string;
  handle?: string;
  message: string;
  emoji?: string;
  avatarGradient?: string;
  reaction?: string; // e.g. "🔥 26"
}

/**
 * Infinite horizontal ticker for social-proof snippets (Discord-style
 * community messages, quick stats, or logo strips).
 *
 * Usage:
 *   <app-marquee [items]="liveMessages" direction="left" />
 *   <app-marquee [items]="liveMessages" direction="right" [speed]="50" />
 */
@Component({
  selector: 'app-marquee',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './marquee.html',
  styleUrl: './marquee.scss',
})
export class Marquee {
  @Input() items: MarqueeItem[] = [];
  @Input() direction: 'left' | 'right' = 'left';
  /** seconds for one full loop — lower is faster */
  @Input() speed = 38;

  readonly icons = { flame: Flame };

  // Duplicate the list so the marquee loop (translateX -50%) is seamless.
  get loopItems(): MarqueeItem[] {
    return [...this.items, ...this.items];
  }
}