import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supabase } from './supabase';

export interface YouTubeVideo {
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string;
  views: number;
  actual_ctr: number | null;
  published_at: string;
  report_id: string | null;
  // Joined from reports when report_id exists
  report?: {
    overall_score: number;
    share_slug: string;
  };
}

export interface SyncResult {
  videos_synced: number;
  total_videos: number;
}

export interface CtrPair {
  title:         string;
  thumbnail_url: string;
  published_at:  string;
  actual_ctr:    number;
  predicted_score: number;
  share_slug:    string;
}

export interface CtrInsight {
  avg_score_high_ctr: number | null;
  avg_score_low_ctr:  number | null;
  message:            string | null;
  pairs:              CtrPair[];
}

@Injectable({ providedIn: 'root' })
export class YouTubeSync {
  private readonly http     = inject(HttpClient);
  private readonly supabase = inject(Supabase);

  private readonly edgeFunctionsUrl = `${environment.supabaseUrl}/functions/v1`;

  readonly syncing   = signal(false);
  readonly error     = signal<string | null>(null);
  readonly videos    = signal<YouTubeVideo[]>([]);
  readonly connected = signal(false);
  readonly insight   = signal<CtrInsight | null>(null);

  // ── Trigger Google OAuth with YouTube scope ───────────────────────────
  async connectYouTube(): Promise<void> {
    await this.supabase.connectYouTube();
    // Page will redirect to /auth/youtube-callback after OAuth
  }

  // ── Called from the callback page after OAuth completes ───────────────
  async sync(providerToken: string): Promise<SyncResult> {
    this.syncing.set(true);
    this.error.set(null);

    try {
      const { data: { session } } = await this.supabase.client.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error('Not signed in');

      const result = await firstValueFrom(
        this.http.post<SyncResult>(
          `${this.edgeFunctionsUrl}/youtube-sync`,
          { accessToken: providerToken },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabaseAnonKey,
              Authorization: `Bearer ${jwt}`,
            },
          }
        )
      );

      this.connected.set(true);
      await this.loadVideos();
      return result;

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      this.error.set(msg);
      throw err;
    } finally {
      this.syncing.set(false);
    }
  }

  // ── Load synced videos from Supabase directly ─────────────────────────
  async loadVideos(): Promise<void> {
    const userId = this.supabase.currentUser()?.id;
    if (!userId) return;

    try {
      const { data, error } = await this.supabase.client
        .from('youtube_videos')
        .select(`
          id,
          youtube_video_id,
          title,
          thumbnail_url,
          views,
          actual_ctr,
          published_at,
          report_id,
          reports (
            overall_score,
            share_slug
          )
        `)
        .eq('user_id', userId)
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      this.videos.set((data ?? []) as YouTubeVideo[]);
      this.connected.set((data ?? []).length > 0);

      // Build CTR insight if enough data
      this.buildInsight();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load videos');
    }
  }

  // ── Check if YouTube is already connected on app load ─────────────────
  async checkConnection(): Promise<void> {
    await this.loadVideos();
  }

  // ── Build CTR correlation insight ─────────────────────────────────────
  private buildInsight(): void {
    const pairs: CtrPair[] = this.videos()
      .filter(v => v.actual_ctr !== null && v.report_id && v.report)
      .map(v => ({
        title:           v.title,
        thumbnail_url:   v.thumbnail_url,
        published_at:    v.published_at,
        actual_ctr:      v.actual_ctr!,
        predicted_score: v.report!.overall_score,
        share_slug:      v.report!.share_slug,
      }));

    if (pairs.length < 3) {
      this.insight.set(null);
      return;
    }

    const highCtr = pairs.filter(p => p.actual_ctr > 5);
    const lowCtr  = pairs.filter(p => p.actual_ctr <= 5);

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    const avgHigh = avg(highCtr.map(p => p.predicted_score));
    const avgLow  = avg(lowCtr.map(p => p.predicted_score));

    this.insight.set({
      avg_score_high_ctr: avgHigh,
      avg_score_low_ctr:  avgLow,
      message: avgHigh
        ? `Your thumbnails scoring above ${avgHigh} tend to get 5%+ CTR`
        : null,
      pairs,
    });
  }
}