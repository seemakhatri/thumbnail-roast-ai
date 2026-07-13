import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/services/supabase';
import { LucideAngularModule, Check, AlertCircle } from 'lucide-angular';


@Component({
  selector: 'app-callback-page',
  imports: [LucideAngularModule],
  templateUrl: './callback-page.html',
  styleUrl: './callback-page.scss',
})
export class CallbackPage implements OnInit {
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<'loading' | 'success' | 'error'>('loading');
  readonly errorMessage = signal<string>('');
    readonly icons = { check: Check, alertCircle: AlertCircle };

  async ngOnInit() {
    const queryError = this.route.snapshot.queryParamMap.get('error');
    const queryErrorDesc = this.route.snapshot.queryParamMap.get('error_description');

    const hash = window.location.hash?.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;

    const hashParams = new URLSearchParams(hash);

    const hashError = hashParams.get('error');
    const hashErrorDesc = hashParams.get('error_description');

    const error = queryError ?? hashError;
    const errorDescription = queryErrorDesc ?? hashErrorDesc;

    if (error) {
      console.error('[CallbackPage] OAuth error:', error, errorDescription);

      this.state.set('error');

      this.errorMessage.set(
        errorDescription
          ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
          : `Sign-in failed (${error}). Please try again.`,
      );

      return;
    }

    // 👇 ADD THIS ENTIRE BLOCK HERE

    try {
      await this.supabase.waitForAuthReady();

      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();

      if (session) {
        this.state.set('success');

        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';

        setTimeout(() => {
          this.router.navigateByUrl(returnUrl);
        }, 800);

        return;
      }

      this.state.set('error');
      this.errorMessage.set('Unable to restore login session.');
    } catch (err) {
      console.error(err);

      this.state.set('error');

      this.errorMessage.set(
        err instanceof Error ? err.message : 'Unexpected authentication error.',
      );
    }
  }
}
