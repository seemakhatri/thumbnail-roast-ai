import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ThumbnailReport } from '../models/report.model';
import { AppUser } from '../models/user.model';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private supabase: SupabaseClient | null = null;

  private readonly restHeaders = {
    apikey: environment.supabaseAnonKey,
    Authorization: `Bearer ${environment.supabaseAnonKey}`,
  };

  // ── Signals ────────────────────────────────────────────────────────────
  readonly currentUser = signal<AppUser | null>(null);
  readonly authLoading = signal<boolean>(true);
  readonly authError = signal<string | null>(null);

  readonly isLoggedIn = computed(() => !!this.currentUser());
  readonly userPlan = computed(() => this.currentUser()?.plan ?? 'free');
  readonly canAnalyze = computed(() => {
    const u = this.currentUser();
    if (!u) return true; // guest gets 3 free
    return u.analyses_used < u.analyses_limit;
  });

  // ── NEW: admin check ──────────────────────────────────────────────────
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      this.initAuthListener();
    } else {
      this.authLoading.set(false);
    }
  }

  async hasSession(): Promise<boolean> {
    const { data: { session } } = await this.client.auth.getSession();
    return !!session;
  }

  public get client(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Supabase auth is only available in the browser.');
    }
    return this.supabase;
  }

  // ── Auth listener ───────────────────────────────────────────────────────
  private initAuthListener(): void {
    // Restore session on load
    this.client.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        this.loadProfile(data.session.user);
      } else {
        this.authLoading.set(false);
      }
    });

    // Live updates
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.loadProfile(session.user);
      }
      if (event === 'SIGNED_OUT') {
        this.currentUser.set(null);
        this.authLoading.set(false);
      }
    });
  }

  // ── Load profile from DB ────────────────────────────────────────────────
  private async loadProfile(authUser: User): Promise<void> {
    this.authLoading.set(true);
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*') // selects all columns, including 'role'
        .eq('id', authUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist yet — create it
        await this.createProfile(authUser);
        return;
      }

      if (error) throw error;
      this.currentUser.set(data as AppUser);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load profile';
      this.authError.set(msg);
    } finally {
      this.authLoading.set(false);
    }
  }

  private async createProfile(authUser: User): Promise<void> {
    const newProfile: Partial<AppUser> = {
      id: authUser.id,
      email: authUser.email ?? '',
      full_name: authUser.user_metadata?.['full_name'] ?? null,
      avatar_url: authUser.user_metadata?.['avatar_url'] ?? null,
      plan: 'free',
      analyses_used: 0,
      analyses_limit: 3,
      role: 'user', // <-- NEW: default role
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('profiles')
      .insert(newProfile)
      .select()
      .single();

    if (error) {
      this.authError.set(error.message);
      return;
    }

    this.currentUser.set(data as AppUser);
  }

  async signInWithGoogle(): Promise<void> {
    this.authError.set(null);

    try {
      const { error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        this.authError.set(error.message);
        throw error;
      }
    } catch (err) {
      console.error('[Supabase] Google Sign-In Error:', err);
      throw err;
    }
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  /** Waits until the initial auth session check completes. */
  waitForAuthReady(): Promise<void> {
    if (!this.authLoading()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!this.authLoading()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  /** Reloads the current user's profile after usage changes. */
  async refreshProfile(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    if (data.session?.user) {
      await this.loadProfile(data.session.user);
    }
  }

  // ── Reports (REST — works in browser and SSR) ───────────────────────────
  async getReportById(id: string): Promise<ThumbnailReport | null> {
    const url = `${environment.supabaseUrl}/rest/v1/reports?id=eq.${encodeURIComponent(id)}&select=*`;
    const response = await fetch(url, { headers: this.restHeaders });

    if (!response.ok) return null;

    const data = (await response.json()) as ThumbnailReport[];
    return data[0] ?? null;
  }

  async getReportBySlug(slug: string): Promise<ThumbnailReport | null> {
    const url = `${environment.supabaseUrl}/rest/v1/reports?share_slug=eq.${encodeURIComponent(slug)}&select=*`;
    const response = await fetch(url, { headers: this.restHeaders });

    if (!response.ok) return null;

    const data = (await response.json()) as ThumbnailReport[];
    return data[0] ?? null;
  }

  async getUserReports(userId: string): Promise<ThumbnailReport[]> {
    const url =
      `${environment.supabaseUrl}/rest/v1/reports?user_id=eq.${encodeURIComponent(userId)}` +
      '&select=*&order=created_at.desc';

    const response = await fetch(url, { headers: this.restHeaders });

    if (!response.ok) {
      throw new Error('Failed to load reports.');
    }

    return (await response.json()) as ThumbnailReport[];
  }

  async connectYouTube(): Promise<void> {
    this.authError.set(null);

    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: `${window.location.origin}/auth/youtube-callback`,
        scopes: [
          'https://www.googleapis.com/auth/youtube.readonly',
          'https://www.googleapis.com/auth/yt-analytics.readonly',
        ].join(' '),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      this.authError.set(error.message);
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    }
  }
}