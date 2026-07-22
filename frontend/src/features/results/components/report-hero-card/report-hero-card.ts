import { Component, computed, inject, input, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate, keyframes } from '@angular/animations';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { ScoreRing } from '../../../../shared/components/score-ring/score-ring';
import {
  LucideAngularModule,
  Flame,
  Share2,
  AlertCircle,
  BarChart3,
  ThumbsUp,
  Trophy,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-angular';

const VERDICT_MAP: Record<string, { label: string; icon: any; css: string }> = {
  needs_work: { label: 'Needs Work', icon: AlertCircle, css: 'verdict--red' },
  decent: { label: 'Decent', icon: BarChart3, css: 'verdict--yellow' },
  good: { label: 'Good', icon: ThumbsUp, css: 'verdict--blue' },
  strong: { label: 'Strong', icon: Flame, css: 'verdict--orange' },
  excellent: { label: 'Excellent', icon: Trophy, css: 'verdict--green' },
};

const PUBLISH_MAP: Record<string, { label: string; icon: any; css: string }> = {
  publish: { label: 'Publish As‑Is', icon: CheckCircle, css: 'publish--green' },
  publish_after_minor_changes: { label: 'Minor Changes', icon: Clock, css: 'publish--yellow' },
  rework: { label: 'Rework', icon: XCircle, css: 'publish--red' },
};

@Component({
  selector: 'app-report-hero-card',
  imports: [ScoreRing, NgClass, RouterLink, LucideAngularModule],
  templateUrl: './report-hero-card.html',
  styleUrl: './report-hero-card.scss',
  animations: [
    trigger('heroEnter', [
      transition(':enter', [
        animate(
          '600ms cubic-bezier(0,.4,.6,1)',
          keyframes([
            style({ opacity: 0, transform: 'scale(0.97) translateY(20px)', offset: 0 }),
            style({ opacity: 1, transform: 'scale(1) translateY(0)', offset: 1 }),
          ])
        ),
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
    checkCircle: CheckCircle,
    clock: Clock,
    xCircle: XCircle,
  };

  readonly verdictData = computed(() => {
    const v = this.report().verdict ?? 'decent';
    return VERDICT_MAP[v] ?? VERDICT_MAP['decent'];
  });

  readonly publishDecision = computed(() => {
    const decision = this.report().publish_decision ?? 'publish';
    return PUBLISH_MAP[decision] ?? PUBLISH_MAP['publish'];
  });

  readonly summary = computed(() => {
    return this.report().executive_summary || 'No summary available.';
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
    const url = `${window.location.origin}/report/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    });
  }
}