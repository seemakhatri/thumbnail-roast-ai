import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Gauge, TrendingUp, TrendingDown, Type,  Minus, Calendar, Palette, Trophy, ThumbsDown, Layers, CheckCircle, AlertCircle, Lightbulb, Zap, Sparkles, RefreshCw, Youtube, ArrowRight, Eye } from 'lucide-angular';
import { ChannelAuditService } from '../../../core/services/channel-audit';
import { Toast } from '../../../core/services/toast';
import { YouTubeSync } from '../../../core/services/youtube-sync';
import { MetricBar } from '../../../shared/components/metric-bar/metric-bar';
import { ScoreRing } from '../../../shared/components/score-ring/score-ring';

@Component({
  selector: 'app-channel-audit',
  imports: [ RouterLink, LucideAngularModule, ScoreRing, MetricBar],
  templateUrl: './channel-audit.html',
  styleUrl: './channel-audit.scss',
})
export class ChannelAudit {
    readonly auditService = inject(ChannelAuditService);
  readonly youtubeSync = inject(YouTubeSync);
  private readonly toast = inject(Toast);
 
  readonly icons = {
    gauge: Gauge,
    trendingUp: TrendingUp,
    trendingDown: TrendingDown,
    minus: Minus,
    calendar: Calendar,
 type: Type,       
    palette: Palette,
    trophy: Trophy,
    thumbsDown: ThumbsDown,
    layers: Layers,
    checkCircle: CheckCircle,
    alertCircle: AlertCircle,
    lightbulb: Lightbulb,
    zap: Zap,
    sparkles: Sparkles,
    refresh: RefreshCw,
    youtube: Youtube,
    arrowRight: ArrowRight,
    eye: Eye,
    
  };
 
  readonly audit = this.auditService.audit;
  readonly loading = this.auditService.loading;
  readonly refreshing = this.auditService.refreshing;
  readonly error = this.auditService.error;
 
  readonly hasEnoughData = computed(() => this.youtubeSync.videos().length >= 5);
 
readonly scoreVerdict = computed(() => {
  const score = this.audit()?.overall_channel_score ?? 0;
  if (score >= 80) return { label: 'Excellent', css: 'v--green' };
  if (score >= 65) return { label: 'Strong', css: 'v--green' };
  if (score >= 50) return { label: 'Decent', css: 'v--yellow' };
  if (score >= 35) return { label: 'Needs Work', css: 'v--red' };  
  return { label: 'Critical', css: 'v--red' };
});
 
  async ngOnInit(): Promise<void> {
    await this.youtubeSync.loadVideos();
    if (this.hasEnoughData()) {
      await this.auditService.load();
    }
  }
 
  async runFirstAudit(): Promise<void> {
    await this.auditService.load();
  }
 
  async refresh(): Promise<void> {
    await this.auditService.refresh();
    if (!this.auditService.error()) {
      this.toast.success('Channel Audit refreshed.');
    } else {
      this.toast.error(this.auditService.error()!);
    }
  }
 
  async syncVideos(): Promise<void> {
    try {
      await this.youtubeSync.sync();
      this.toast.success('YouTube videos synced.');
      if (this.hasEnoughData()) {
        await this.auditService.load();
      }
    } catch {
      this.toast.error(this.youtubeSync.error() ?? 'Sync failed.');
    }
  }
 
  trendIcon(direction: string): any {
    if (direction === 'improving') return this.icons.trendingUp;
    if (direction === 'declining') return this.icons.trendingDown;
    return this.icons.minus;
  }
 
  trendCss(direction: string): string {
    if (direction === 'improving') return 't--green';
    if (direction === 'declining') return 't--red';
    return 't--neutral';
  }
 
  trendLabel(direction: string): string {
    const map: Record<string, string> = {
      improving: 'Improving',
      declining: 'Declining',
      stable: 'Stable',
      not_enough_data: 'Not enough data yet',
    };
    return map[direction] ?? direction;
  }
 
  formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
 
  formatViews(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  }
 
  timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

}
