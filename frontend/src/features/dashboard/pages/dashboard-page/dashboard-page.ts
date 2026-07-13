import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Supabase } from '../../../../core/services/supabase';
import { Dashboard } from '../../../../core/services/dashboard';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { ReportHistory } from '../../components/report-history/report-history';
import { YouTubeSync } from '../../../../core/services/youtube-sync';
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  Flame,
  BarChart3,
  Target,
  Sparkles,
  Youtube,
  RefreshCw,
  AlertCircle,
  Infinity as InfinityIcon,
  Crown,
  ClipboardList,
  ChevronRight,
  ArrowUpRight,
  LucideAngularModule,
  Settings,
} from 'lucide-angular';
import { environment } from '../../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Toast } from '../../../../core/services/toast';
import { firstValueFrom } from 'rxjs';

type SidebarSection = 'overview' | 'reports' | 'youtube';
const UNLIMITED_THRESHOLD = 1000;

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, ReportHistory, DatePipe, TitleCasePipe, CommonModule, LucideAngularModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  readonly supabase = inject(Supabase);
  readonly dashboard = inject(Dashboard);
  readonly youtube = inject(YouTubeSync);
  private readonly http = inject(HttpClient);
  private toast = inject(Toast);
  private readonly edgeFunctionsUrl = `${environment.supabaseUrl}/functions/v1`;

  // Expose Math for template use
  readonly Math = Math;

  readonly isPaidPlan = computed(() => {
    const plan = this.user()?.plan;
    return plan && plan !== 'free';
  });
  readonly icons = {
    dashboard: LayoutDashboard,
    calendar: Calendar,
    trophy: Trophy,
    flame: Flame,
    barChart: BarChart3,
    target: Target,
    sparkles: Sparkles,
    youtube: Youtube,
    refresh: RefreshCw,
    alertCircle: AlertCircle,
    infinity: InfinityIcon,
    crown: Crown,
    reports: ClipboardList,
    chevron: ChevronRight,
    upgrade: ArrowUpRight,
    settings: Settings,
  };

  readonly activeSection = signal<SidebarSection>('overview');

  readonly user = computed(() => this.supabase.currentUser());
  readonly initials = computed(() => {
    const name = this.user()?.full_name ?? this.user()?.email ?? 'U';
    return name.charAt(0).toUpperCase();
  });
  readonly loading = computed(() => this.dashboard.loading() || this._fallbackLoading());
  readonly error = computed(() => this.dashboard.error() ?? this._fallbackError());

  readonly reports = computed((): ThumbnailReport[] => {
    const fromDashboard = this.dashboard.recent();
    if (fromDashboard.length > 0) return fromDashboard;
    return this._fallbackReports();
  });

  readonly stats = computed(() => this.dashboard.stats());
  readonly scoreDelta = computed(() => this.dashboard.scoreDelta());
  readonly nicheBenchmark = computed(() => this.dashboard.myNicheBenchmark());
  readonly isUnlimited = computed(() => (this.user()?.analyses_limit ?? 0) >= UNLIMITED_THRESHOLD);

  readonly usagePercentage = computed(() => {
    const u = this.user();
    if (!u || u.analyses_limit === 0) return 0;
    if (this.isUnlimited()) return 100;
    return Math.min(100, (u.analyses_used / u.analyses_limit) * 100);
  });

  readonly remainingAnalyses = computed(() => {
    const u = this.user();
    if (!u) return 0;
    return Math.max(0, u.analyses_limit - u.analyses_used);
  });

  // Ring circumference for usage circle (2 * π * 34)
  readonly ringCircumference = 2 * Math.PI * 34;

  readonly ringOffset = computed(() => {
    const pct = this.usagePercentage();
    return this.ringCircumference - (pct / 100) * this.ringCircumference;
  });

  private readonly _fallbackReports = signal<ThumbnailReport[]>([]);
  private readonly _fallbackLoading = signal(true);
  private readonly _fallbackError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    void this.loadDashboard();
    setTimeout(async () => {
      console.log('[Dashboard] Force loading YouTube videos...');
      await this.youtube.loadVideos();
      console.log('[Dashboard] YouTube videos after force load:', this.youtube.videos().length);
    }, 3000);
  }

  getDebugInfo() {
    return {
      connected: this.youtube.connected(),
      videos: this.youtube.videos().length,
      loading: this.youtube.loading(),
      error: this.youtube.error(),
      userId: this.supabase.currentUser()?.id,
    };
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
    try {
      const result = await this.youtube.sync();
      const message = `Synced ${result.inserted} new videos, ${result.updated} updated`;
      console.log(message);
      await this.youtube.loadVideos();
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }

  // ─── UI HELPERS ──────────────────────────────────────────────────────

  /**
   * Get color for a score value
   */
  scoreColor(score: number): string {
    if (score >= 75) return 'var(--green)';
    if (score >= 50) return 'var(--yellow)';
    return 'var(--red)';
  }

  /**
   * Get human-readable plan name
   */
  getPlanDisplayName(plan: string): string {
    const names: Record<string, string> = {
      free: 'Free',
      creator: 'Creator',
      business: 'Business',
      agency: 'Agency',
    };
    return names[plan] || plan;
  }

  /**
   * Scroll to a specific section
   */
  scrollTo(section: SidebarSection): void {
    this.activeSection.set(section);
    if (section === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Calculate percentage difference between two values
   * Used for niche benchmark comparison
   */
  getPercentageDifference(value: number, benchmark: number): string {
    if (benchmark === 0) return '0';
    const diff = ((value - benchmark) / benchmark) * 100;
    return Math.abs(Math.round(diff)).toString();
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboard(): Promise<void> {
    await this.dashboard.load();
    if (this.youtube.connected()) {
      await this.youtube.loadVideos();
    }
  }

  async openManageSubscription(): Promise<void> {
    try {
      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');

      const response = await firstValueFrom(
        this.http.post<{ url: string }>(
          `${this.edgeFunctionsUrl}/create-portal-session`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: environment.supabaseAnonKey,
            },
          },
        ),
      );

      if (response.url) {
        window.location.href = response.url;
      }
    } catch (error) {
      this.toast.error('Unable to open subscription manager. Please try again.');
    }
  }
}
