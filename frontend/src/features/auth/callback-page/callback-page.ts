import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/services/supabase';

@Component({
  selector: 'app-callback-page',
  imports: [],
  templateUrl: './callback-page.html',
  styleUrl: './callback-page.scss',
})
export class CallbackPage {
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
 
  readonly state = signal<'loading' | 'success' | 'error'>('loading');
  readonly errorMessage = signal<string>('');
 
async ngOnInit() {
  const code = this.route.snapshot.queryParamMap.get('code');

  if (code) {
    const { error } =
      await this.supabase.client.auth.exchangeCodeForSession(code);

    if (error) {
      this.state.set('error');
      this.errorMessage.set(error.message);
      return;
    }
  }

  this.watchAuth();
}


  private watchAuth(): void {
    // Poll every 300ms until authLoading is false (max 10s)
    let attempts = 0;
    const MAX = 33;
 
    const check = () => {
      attempts++;
 
      if (this.supabase.authLoading()) {
        if (attempts < MAX) {
          setTimeout(check, 300);
        } else {
          this.state.set('error');
          this.errorMessage.set('Authentication timed out. Please try again.');
        }
        return;
      }
 
      if (this.supabase.isLoggedIn()) {
        this.state.set('success');
        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        setTimeout(() => this.router.navigateByUrl(returnUrl), 900);
      } else {
        this.state.set('error');
        this.errorMessage.set(
          this.supabase.authError() ?? 'Sign-in was cancelled or failed.'
        );
      }
    };
 
    setTimeout(check, 300);
  }
}
