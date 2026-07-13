import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Supabase } from '../../../core/services/supabase';
import { Toast } from '../../../core/services/toast';
import { YouTubeSync } from '../../../core/services/youtube-sync';

@Component({
  selector: 'app-youtube-callback',
  standalone: true,
  imports: [],
  templateUrl: './youtube-callback.html',
  styleUrl: './youtube-callback.scss',
})
export class YoutubeCallback {
  private readonly supabase = inject(Supabase);
  private readonly youtubeSync = inject(YouTubeSync);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);

  message = 'Connecting your YouTube channel…';

  async ngOnInit(): Promise<void> {
    console.log('✅ CALLBACK LOADED');
    console.log('URL:', window.location.href);

    try {
      // ── NEW: check for an `error` param FIRST, before assuming a `code`
      // means success. Same class of bug as callback-page.ts — a failed
      // external token exchange comes back as error/error_description,
      // not as `code`, and the old code had no check for this at all
      // here either, so it would silently continue on to
      // waitForAuthReady() and eventually just throw a vague
      // "No authenticated session found."
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      if (error) {
        throw new Error(
          errorDescription
            ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
            : `YouTube connection failed (${error}).`,
        );
      }

      // Wait for Supabase auth initialization
      await this.supabase.waitForAuthReady();
      let {
        data: { session },
      } = await this.supabase.client.auth.getSession();

      console.log('Initial session:', session);

      // If no session yet but we have a PKCE code, exchange it
      if (!session) {
        const code = params.get('code');

        console.log('OAuth code:', code);

        if (code) {
          const { error: exchangeError } =
            await this.supabase.client.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('Exchange failed:', exchangeError);
            throw exchangeError;
          }

          const result = await this.supabase.client.auth.getSession();
          session = result.data.session;

          console.log('Session after exchange:', session);
        }
      }

      if (!session) {
        throw new Error('No authenticated session found.');
      }

      // ── use provider_refresh_token, not provider_token ─────────
      // provider_token is a short-lived (~1hr) Google access token — fine
      // for a one-off call right now, useless for syncing again next week.
      // provider_refresh_token is the long-lived credential that actually
      // needs to be stored server-side (in youtube_connections) so future
      // syncs don't require the user to reconnect every time.
      const providerRefreshToken = session.provider_refresh_token;

      console.log('Provider refresh token present:', !!providerRefreshToken);

      if (!providerRefreshToken) {
        // If this fires, the most common cause is that YouTube scopes
        // weren't actually requested from Google — see the
        // options.scopes fix in Supabase.connectYouTube(). Passing scope
        // via queryParams instead of options.scopes can silently drop it.
        throw new Error(
          'Google returned no refresh token. Check that access_type=offline, ' +
          'prompt=consent, and scopes are set via options.scopes in connectYouTube().'
        );
      }

      // STEP 1 — store the refresh token server-side BEFORE syncing.
      // sync() depends on youtube_connections already having a row; if
      // connect() fails, we must not attempt sync() at all.
      this.message = 'Saving your YouTube connection…';
      await this.youtubeSync.connect(providerRefreshToken);

      // STEP 2 — now sync can actually find something to sync from.
      this.message = 'Syncing your YouTube videos…';
      const result = await this.youtubeSync.sync();

      this.toast.success(
        `YouTube connected! Found ${result.total_videos} videos.`
      );

      await this.router.navigate(['/dashboard']);
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : 'YouTube sync failed';

      this.toast.error(message);

      await this.router.navigate(['/dashboard']);
    }
  }
}