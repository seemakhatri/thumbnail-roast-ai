import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Supabase } from '../../../../core/services/supabase';
import { Dashboard } from '../../../../core/services/dashboard';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { UsageOverview } from '../../components/usage-overview/usage-overview';
import { ReportHistory } from '../../components/report-history/report-history';
import { YouTubeSync } from '../../../../core/services/youtube-sync';
import { 
  LayoutDashboard, 
  User, 
  Calendar, 
  TrendingUp, 
  Trophy, 
  Flame,
  BarChart3,
  Target,
  Sparkles,
  Zap,
  Youtube,
  RefreshCw,
  AlertCircle,
  LucideAngularModule 
} from 'lucide-angular';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, UsageOverview, ReportHistory, DatePipe, TitleCasePipe, CommonModule, LucideAngularModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  readonly supabase = inject(Supabase);
  readonly dashboard = inject(Dashboard);
  readonly youtube = inject(YouTubeSync);

  // Lucide icons
  readonly icons = {
    dashboard: LayoutDashboard,
    user: User,
    calendar: Calendar,
    trendingUp: TrendingUp,
    trophy: Trophy,
    flame: Flame,
    barChart: BarChart3,
    target: Target,
    sparkles: Sparkles,
    zap: Zap,
    youtube: Youtube,
    refresh: RefreshCw,
    alertCircle: AlertCircle
  };

  // ── Auth ───────────────────────────────────────────────────────────────
  readonly user = computed(() => this.supabase.currentUser());
  readonly initials = computed(() => {
    const name = this.user()?.full_name ?? this.user()?.email ?? 'U';
    return name.charAt(0).toUpperCase();
  });

  // ── Loading / Error ────────────────────────────────────────────────────
  readonly loading = computed(() => this.dashboard.loading() || this._fallbackLoading());
  readonly error = computed(() => this.dashboard.error() ?? this._fallbackError());

  // ── Reports ────────────────────────────────────────────────────────────
  readonly reports = computed((): ThumbnailReport[] => {
    const fromDashboard = this.dashboard.recent();
    if (fromDashboard.length > 0) return fromDashboard;
    return this._fallbackReports();
  });

  // ── Stats ─────────────────────────────────────────────────────────────
  readonly stats = computed(() => this.dashboard.stats());
  readonly scoreDelta = computed(() => this.dashboard.scoreDelta());
  readonly nicheBenchmark = computed(() => this.dashboard.myNicheBenchmark());

  // ── Fallback state ─────────────────────────────────────────────────────
  private readonly _fallbackReports = signal<ThumbnailReport[]>([]);
  private readonly _fallbackLoading = signal(true);
  private readonly _fallbackError = signal<string | null>(null);

  // ── Init ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    void this.loadDashboard();
  }

  private async loadDashboard(): Promise<void> {
    await this.supabase.waitForAuthReady();
    await this.youtube.checkConnection();

    const userId = this.user()?.id;
    if (!userId) {
      this._fallbackLoading.set(false);
      return;
    }

    await this.loadReportsFallback(userId);
    void this.dashboard.load();
  }

  private async loadReportsFallback(userId: string): Promise<void> {
    this._fallbackLoading.set(true);
    this._fallbackError.set(null);

    try {
      const data = await this.supabase.getUserReports(userId);
      this._fallbackReports.set(data);
    } catch {
      this._fallbackError.set('Failed to load your reports.');
    } finally {
      this._fallbackLoading.set(false);
    }
  }

  async connectYouTube(): Promise<void> {
    await this.youtube.connectYouTube();
  }

  async resync(): Promise<void> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    const token = session?.provider_token;
    if (!token) {
      await this.youtube.connectYouTube();
      return;
    }
    await this.youtube.sync(token);
  }

  scoreColor(score: number): string {
    if (score >= 75) return 'var(--green)';
    if (score >= 50) return 'var(--yellow)';
    return 'var(--red)';
  }

  getRemainingAnalyses(): number {
    const user = this.user();
    if (!user) return 0;
    return Math.max(0, user.analyses_limit - user.analyses_used);
  }

  getUsagePercentage(): number {
    const user = this.user();
    if (!user || user.analyses_limit === 0) return 0;
    return Math.min(100, (user.analyses_used / user.analyses_limit) * 100);
  }

  getPlanDisplayName(plan: string): string {
    const names: Record<string, string> = {
      'free': 'Free',
      'creator': 'Creator',
      'business': 'Business',
      'agency': 'Agency'
    };
    return names[plan] || plan;
  }

  getPlanLimit(plan: string): number {
    const limits: Record<string, number> = {
      'free': 3,
      'creator': 50,
      'business': 200,
      'agency': 500
    };
    return limits[plan] || 3;
  }
}