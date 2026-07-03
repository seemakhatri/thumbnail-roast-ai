import { computed, inject, Injectable, signal } from '@angular/core';
import { Gemini } from './gemini';
import { Supabase } from './supabase';
import { DashboardData, NicheBenchmark } from '../models/dashboard.model';
import { ThumbnailReport } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class Dashboard {
  private readonly gemini  = inject(Gemini);
  private readonly supabase = inject(Supabase);

  // ── State ──────────────────────────────────────────────────────────────
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);
  readonly data      = signal<DashboardData | null>(null);

  // ── Derived signals — use directly in templates ────────────────────────
  readonly stats      = computed(() => this.data()?.stats ?? null);
  readonly recent     = computed(() => this.data()?.recent ?? []);
  readonly benchmarks = computed(() => this.data()?.benchmarks ?? []);

  // Score delta: how much improved vs previous 30 days
  readonly scoreDelta = computed(() => {
    const s = this.stats();
    if (!s) return null;
    return s.avg_score_30d - s.avg_score_prev;
  });

  // User's niche benchmark — matches niche of their most recent report
  readonly myNicheBenchmark = computed(() => {
    const recentNiche = this.recent()[0]?.niche;
    if (!recentNiche) return null;
    return this.benchmarks().find(b => b.niche === recentNiche) ?? null;
  });

  // ── Load ───────────────────────────────────────────────────────────────
  async load(): Promise<void> {
    if (!this.supabase.isLoggedIn()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.gemini.getDashboard();
      this.data.set(result);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  /** Call after a new analysis completes to refresh the dashboard. */
  async refresh(): Promise<void> {
    await this.load();
  }
}