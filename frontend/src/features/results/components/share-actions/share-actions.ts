import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { Toast } from '../../../../core/services/toast';
import { LucideAngularModule, Share2, Twitter, Flame } from 'lucide-angular';

export type ResultsTab = 'overview' | 'recommendations' | 'competitor';

@Component({
  selector: 'app-share-actions',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './share-actions.html',
  styleUrl: './share-actions.scss',
})
export class ShareActions {
  readonly report = input<ThumbnailReport | null>(null);
  readonly showTabs = input(true);

  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  readonly activeTab = signal<ResultsTab>('overview');

  readonly icons = {
    share: Share2,
    twitter: Twitter,
    flame: Flame,
  };

  setTab(tab: ResultsTab): void {
    this.activeTab.set(tab);
    const sectionId =
      tab === 'recommendations'
        ? 'recommendations-section'
        : tab === 'competitor'
          ? 'competitor-section'
          : 'overview-section';

    // Try to find the element
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback: scroll to top of the page (overview) or just log
      console.warn(`Section ${sectionId} not found – scrolling to top`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async copyShareLink(): Promise<void> {
    const slug = this.report()?.share_slug;
    if (!slug) return;

    const url = `${window.location.origin}/report/${slug}`;

    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Share link copied to clipboard!');
    } catch {
      this.toast.error('Could not copy link. Please copy manually.');
    }
  }

  tweetScore(): void {
    const report = this.report();
    if (!report) return;

    const text = encodeURIComponent(
      `My YouTube thumbnail scored ${report.overall_score}/100 on @ThumbnailRoast 🔥\n\n"${report.roast_title}"\n\nRoast yours free →`,
    );
    const url = encodeURIComponent(`${window.location.origin}/report/${report.share_slug}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener');
  }

  newAnalysis(): void {
    this.router.navigate(['/analyze']);
  }
}