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
    try {
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

      await this.supabase.waitForAuthReady();
      let {
        data: { session },
      } = await this.supabase.client.auth.getSession();

      // If no session yet but we have a PKCE code, exchange it
      if (!session) {
        const code = params.get('code');

        if (code) {
          const { error: exchangeError } =
            await this.supabase.client.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('Exchange failed:', exchangeError);
            throw exchangeError;
          }

          const result = await this.supabase.client.auth.getSession();
          session = result.data.session;
        }
      }

      if (!session) {
        throw new Error('No authenticated session found.');
      }

      const providerRefreshToken = session.provider_refresh_token;

      if (!providerRefreshToken) {
        throw new Error(
          'Google returned no refresh token. Check that access_type=offline, ' +
            'prompt=consent, and scopes are set via options.scopes in connectYouTube().',
        );
      }

      this.message = 'Saving your YouTube connection…';
      await this.youtubeSync.connect(providerRefreshToken);

      this.message = 'Syncing your YouTube videos…';
      const result = await this.youtubeSync.sync();

      this.toast.success(`YouTube connected! Found ${result.total_videos} videos.`);

      await this.router.navigate(['/dashboard']);
    } catch (err) {
      console.error(err);

      const message = err instanceof Error ? err.message : 'YouTube sync failed';

      this.toast.error(message);

      await this.router.navigate(['/dashboard']);
    }
  }
}
