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
      // Wait for Supabase auth initialization
      await this.supabase.waitForAuthReady();
      let {
        data: { session },
      } = await this.supabase.client.auth.getSession();

      console.log('Initial session:', session);

      // If no session yet but we have a PKCE code, exchange it
      if (!session) {
        const code = new URLSearchParams(window.location.search).get('code');

        console.log('OAuth code:', code);

        if (code) {
          const { error } =
            await this.supabase.client.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('Exchange failed:', error);
            throw error;
          }

          const result = await this.supabase.client.auth.getSession();
          session = result.data.session;

          console.log('Session after exchange:', session);
        }
      }

      if (!session) {
        throw new Error('No authenticated session found.');
      }

      const providerToken = session.provider_token;

      console.log('Provider token:', providerToken);

      if (!providerToken) {
        throw new Error(
          'Google returned no provider token. Check Google OAuth scopes.'
        );
      }

      this.message = 'Syncing your YouTube videos…';

      const result = await this.youtubeSync.sync(providerToken);

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