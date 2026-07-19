import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, TrendingUp, Target, Lightbulb, Sparkles, Layers, Users, MessageSquare, Share2, Search, Plus, ChevronRight } from 'lucide-angular';

import { Research } from '../../../core/services/research';
import { Toast } from '../../../core/services/toast';
import { ResearchMode, ResearchSession } from '../../../core/models/research.model';

interface ModeOption {
  value: ResearchMode;
  label: string;
  placeholder: string;
  icon: any; // Lucide icon
}

@Component({
  selector: 'app-research-page',
  standalone: true,
  imports: [FormsModule, DecimalPipe, LucideAngularModule],
  templateUrl: './research-page.html',
  styleUrl: './research-page.scss',
})
export class ResearchPage {
  private readonly research = inject(Research);
  private readonly toast = inject(Toast);

  // ─── Icons ──────────────────────────────────────────────────────────
  readonly icons = {
    trending: TrendingUp,
    target: Target,
    lightbulb: Lightbulb,
    sparkles: Sparkles,
    layers: Layers,
    users: Users,
    message: MessageSquare,
    share: Share2,
    search: Search,
    plus: Plus,
    chevron: ChevronRight,
  };

  // ─── Mode options ────────────────────────────────────────────────
  readonly modeOptions: ModeOption[] = [
    { value: 'niche', label: 'Niche', placeholder: 'e.g. personal finance, home workouts', icon: TrendingUp },
    { value: 'keyword', label: 'Keyword', placeholder: 'e.g. how to invest for beginners', icon: Search },
    { value: 'channel', label: 'Channel', placeholder: 'e.g. @MrBeast or a channel URL', icon: Users },
  ];

  // ─── Signals ──────────────────────────────────────────────────────
  readonly mode = signal<ResearchMode>('niche');
  readonly inputValue = signal('');
  readonly loading = signal(false);
  readonly session = signal<ResearchSession | null>(null);
  readonly error = signal<string | null>(null);

  // ─── Computed: Opportunity Score ────────────────────────────────
  readonly opportunityScore = computed(() => {
    const s = this.session();
    if (!s) return 0;

    const volumeMap: Record<string, number> = { high: 80, medium: 50, low: 20 };
    const competitionMap: Record<string, number> = { low: 80, medium: 50, high: 20 };

    const vol = volumeMap[s.insights.search_volume_signal] ?? 40;
    const comp = competitionMap[s.insights.competition_level] ?? 40;

    // Weighted: demand 60%, competition 40%
    return Math.round(vol * 0.6 + comp * 0.4);
  });

  readonly opportunityLabel = computed(() => {
    const score = this.opportunityScore();
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  });

  // ─── Computed: Strategy ──────────────────────────────────────────
  readonly strategy = computed(() => {
    const s = this.session();
    if (!s) return '';

    const gaps = s.insights.content_gaps;
    const topics = s.insights.trending_topics;
    const audience = s.insights.audience_interests[0] || 'your audience';
    const topGap = gaps.length ? gaps[0] : 'a unique angle';
    const topTopic = topics.length ? topics[0] : 'popular content';

    return `Double down on "${topGap}" – this is what ${audience} are actively searching for, yet few creators are covering it. Combine it with "${topTopic}" to ride the wave while standing out.`;
  });

  // ─── Computed: Top 5 Video Ideas ────────────────────────────────
  readonly videoIdeas = computed(() => {
    const s = this.session();
    if (!s) return [];

    const topics = s.insights.trending_topics.slice(0, 3);
    const gaps = s.insights.content_gaps.slice(0, 3);
    const audience = s.insights.audience_interests[0] || 'viewers';
    const ideas: string[] = [];

    // Combine topics and gaps for strong ideas
    for (let i = 0; i < Math.min(topics.length, gaps.length) && ideas.length < 5; i++) {
      ideas.push(`${topics[i]} for ${audience} – ${gaps[i]}`);
    }

    // Fallback combinations
    while (ideas.length < 5) {
      const t = topics[ideas.length % topics.length] || 'trending content';
      const g = gaps[ideas.length % gaps.length] || 'fresh angle';
      ideas.push(`${t} with a ${g} twist`);
    }

    return ideas.slice(0, 5);
  });

  // ─── Thumbnail icon helper (fallback to Lucide) ────────────────
  getThumbnailIcon(style: string): string {
    const lower = style.toLowerCase();
    if (lower.includes('text overlay')) return '📝';
    if (lower.includes('demonstrat') || lower.includes('person')) return '🧘';
    if (lower.includes('model') || lower.includes('trainer')) return '💪';
    if (lower.includes('minimalist')) return '✨';
    if (lower.includes('no equipment') || lower.includes('home')) return '🏠';
    if (lower.includes('action') || lower.includes('dynamic')) return '⚡';
    if (lower.includes('bold number')) return '🔢';
    if (lower.includes('before') || lower.includes('after')) return '🔄';
    if (lower.includes('arrow')) return '👉';
    if (lower.includes('contrast')) return '🎨';
    return '🖼️';
  }

  // ─── UI methods ──────────────────────────────────────────────────
  selectMode(mode: ResearchMode): void {
    this.mode.set(mode);
  }

  currentPlaceholder(): string {
    return this.modeOptions.find((m) => m.value === this.mode())?.placeholder ?? '';
  }

  async submit(): Promise<void> {
    const input = this.inputValue().trim();
    if (input.length < 2) {
      this.toast.error('Please enter at least 2 characters.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await this.research.run(this.mode(), input);
      this.session.set(session);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Research run failed.';
      this.error.set(message);
      this.toast.error(message);
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    this.session.set(null);
    this.error.set(null);
    this.inputValue.set('');
  }

  share(): void {
    const session = this.session();
    if (!session) return;
    const url = `${window.location.origin}/research?session=${session.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Research link copied to clipboard!');
    }).catch(() => {
      prompt('Copy this link to share:', url);
    });
  }
}