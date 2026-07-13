import { Component, computed, inject, input, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate, keyframes } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { ScoreRing } from '../../../../shared/components/score-ring/score-ring';
import { LucideAngularModule, Flame, Share2 } from 'lucide-angular';

const VERDICT_MAP: Record<string, { label: string; emoji: string; css: string }> = {
  needs_work: { label: 'Needs Work',  emoji: '⚠️',  css: 'verdict--red'    },
  decent:     { label: 'Decent',      emoji: '📊',  css: 'verdict--yellow' },
  good:       { label: 'Good',        emoji: '👍',  css: 'verdict--blue'   },
  strong:     { label: 'Strong',      emoji: '🔥',  css: 'verdict--orange' },
  excellent:  { label: 'Excellent',   emoji: '🏆',  css: 'verdict--green'  },
};

@Component({
  selector: 'app-report-hero-card',
  imports: [ScoreRing, NgClass, RouterLink, LucideAngularModule],
  templateUrl: './report-hero-card.html',
  styleUrl: './report-hero-card.scss',
  animations: [
    trigger('heroEnter', [
      transition(':enter', [
        animate('600ms cubic-bezier(0,.4,.6,1)', keyframes([
          style({ opacity: 0, transform: 'scale(0.97) translateY(20px)', offset: 0 }),
          style({ opacity: 1, transform: 'scale(1) translateY(0)',        offset: 1 }),
        ])),
      ]),
    ]),
  ],
})
export class ReportHeroCard {
  readonly report = input.required<ThumbnailReport>();

  private readonly platformId = inject(PLATFORM_ID);

  readonly copied = signal(false);

  readonly icons = {
    flame: Flame,
    share: Share2,
  };

  readonly verdictData = computed(() => {
    const v = this.report().verdict ?? 'decent';
    return VERDICT_MAP[v] ?? VERDICT_MAP['decent'];
  });

  readonly summary = computed(() => {
    const r = this.report();
    const score = r.overall_score;
    const ctr   = r.ctr_score;
    const emo   = r.emotion_score;

    if (score >= 80) return 'Your thumbnail has elite visual impact — minor tweaks could push it further.';
    if (score >= 65) return `Strong CTR potential (${ctr}/100) but emotion and curiosity could be stronger.`;
    if (score >= 50) return `Competent but forgettable. Readability and emotional hook need the most work.`;
    return `Low click-through potential. The core concept and visual execution both need rebuilding.`;
  });

  readonly ringGlow = computed(() => {
    const s = this.report().overall_score;
    if (s >= 70) return 'radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 65%)';
    if (s >= 50) return 'radial-gradient(circle, rgba(234,179,8,0.15) 0%, transparent 65%)';
    return 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 65%)';
  });

  copyShareLink(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const slug = this.report().share_slug;
    const url  = `${window.location.origin}/report/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    });
  }
}