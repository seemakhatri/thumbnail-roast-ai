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
  impressions?: number;
  actual_ctr: number | null;
  ctr?: string | null;
  published_at: string;
  report_id: string | null;
  created_at?: string;
  updated_at?: string;
report?: {
  overall_score: number;
  share_slug: string;
} | null;
}

export interface SyncResult {
  processed: number;
  inserted: number;
  updated: number;
  videos_synced: number;
  total_videos: number;
}

export interface CtrPair {
  title: string;
  thumbnail_url: string;
  published_at: string;
  actual_ctr: number;
  predicted_score: number;
  share_slug: string;
}

export interface CtrInsight {
  avg_score_high_ctr: number | null;
  avg_score_low_ctr: number | null;
  message: string | null;
  pairs: CtrPair[];
}

@Injectable({ providedIn: 'root' })
export class YouTubeSync {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(Supabase);

  private readonly edgeFunctionsUrl = `${environment.supabaseUrl}/functions/v1`;

  readonly syncing = signal(false);
  readonly connecting = signal(false);
  readonly error = signal<string | null>(null);
  readonly videos = signal<YouTubeVideo[]>([]);
  readonly connected = signal(false);
  readonly insight = signal<CtrInsight | null>(null);
  readonly loading = signal(false);

  async connectYouTube(): Promise<void> {
    await this.supabase.connectYouTube();
  }

  async connect(providerRefreshToken: string): Promise<void> {
    this.connecting.set(true);
    this.error.set(null);

    try {
      const { data: { session } } = await this.supabase.client.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error('Not signed in');

      await firstValueFrom(
        this.http.post(
          `${this.edgeFunctionsUrl}/youtube-connect`,
          { providerRefreshToken },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabaseAnonKey,
              Authorization: `Bearer ${jwt}`,
            },
          },
        ),
      );

      this.connected.set(true);
      await this.loadVideos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect YouTube account';
      this.error.set(msg);
      throw err;
    } finally {
      this.connecting.set(false);
    }
  }

  async sync(): Promise<SyncResult> {
    this.syncing.set(true);
    this.error.set(null);

    try {
      const { data: { session } } = await this.supabase.client.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error('Not signed in');

      const response = await firstValueFrom(
        this.http.post<any>(
          `${this.edgeFunctionsUrl}/youtube-sync`,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabaseAnonKey,
              Authorization: `Bearer ${jwt}`,
            },
          }
        )
      );

      const result: SyncResult = {
        processed: response.processed ?? response.videos_synced ?? 0,
        inserted: response.inserted ?? response.videos_synced ?? 0,
        updated: response.updated ?? 0,
        videos_synced: response.videos_synced ?? response.inserted ?? 0,
        total_videos: response.total_videos ?? 0,
      };

      this.connected.set(true);
      await this.loadVideos();
      
      console.log(`[YouTubeSync] Sync complete: ${result.inserted} new, ${result.updated} updated`);
      
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      this.error.set(msg);
      throw err;
    } finally {
      this.syncing.set(false);
    }
  }

async loadVideos(): Promise<void> {
  this.loading.set(true);
  this.error.set(null);
  
  try {
    // ── Wait for auth ──────────────────────────────────────────────────
    await this.supabase.waitForAuthReady();
    
    const userId = this.supabase.currentUser()?.id;
    console.log('[YouTubeSync] Loading videos for user:', userId);
    
    if (!userId) {
      console.warn('[YouTubeSync] No user ID available');
      this.videos.set([]);
      this.loading.set(false);
      return;
    }

    // ── FIRST: Check if connection exists ─────────────────────────────
    const { data: connection, error: connError } = await this.supabase.client
      .from('youtube_connections')
      .select('user_id, channel_id, last_synced_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (connError) {
      console.error('[YouTubeSync] Connection check error:', connError);
    }

    const isConnected = !!connection;
    this.connected.set(isConnected);
    console.log('[YouTubeSync] Connected:', isConnected);
    console.log('[YouTubeSync] Connection data:', connection);

    // ── SECOND: Query videos ──────────────────────────────────────────
    console.log('[YouTubeSync] Querying videos...');
    
const { data, error } = await this.supabase.client
  .from('youtube_videos')
  .select(`
    id,
    youtube_video_id,
    title,
    thumbnail_url,
    views,
    impressions,
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

    if (error) {
      console.error('[YouTubeSync] Query error:', error);
      console.error('[YouTubeSync] Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    
    if (data && data.length > 0) {
      console.log('[YouTubeSync] First video:', data[0].title);
    } else {
      console.warn('[YouTubeSync] No videos found in database for user');
    }

    // ── Set videos ─────────────────────────────────────────────────────
const videos: YouTubeVideo[] =
  (data ?? []).map((video: any) => ({
    ...video,
    report: Array.isArray(video.reports)
      ? video.reports[0] ?? null
      : video.reports ?? null,
  }));

this.videos.set(videos);

    // ── Build insight ──────────────────────────────────────────────────
    this.buildInsight();
    
  } catch (err) {
    console.error('[YouTubeSync] loadVideos error:', err);
    this.error.set(err instanceof Error ? err.message : 'Failed to load videos');
    this.videos.set([]);
  } finally {
    this.loading.set(false);
  }
}

  async checkConnection(): Promise<void> {
    console.log('[YouTubeSync] Checking connection...');
    await this.loadVideos();
  }

  private buildInsight(): void {
    const pairs: CtrPair[] = this.videos()
      .filter((v) => v.actual_ctr !== null && v.report_id && v.report)
      .map((v) => ({
        title: v.title,
        thumbnail_url: v.thumbnail_url,
        published_at: v.published_at,
        actual_ctr: v.actual_ctr!,
        predicted_score: v.report!.overall_score,
        share_slug: v.report!.share_slug,
      }));

    if (pairs.length < 3) {
      this.insight.set(null);
      return;
    }

    const highCtr = pairs.filter((p) => p.actual_ctr > 5);
    const lowCtr = pairs.filter((p) => p.actual_ctr <= 5);

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    const avgHigh = avg(highCtr.map((p) => p.predicted_score));
    const avgLow = avg(lowCtr.map((p) => p.predicted_score));

    this.insight.set({
      avg_score_high_ctr: avgHigh,
      avg_score_low_ctr: avgLow,
      message: avgHigh ? `Your thumbnails scoring above ${avgHigh} tend to get 5%+ CTR` : null,
      pairs,
    });
  }
}