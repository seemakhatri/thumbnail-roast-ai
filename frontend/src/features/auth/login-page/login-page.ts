import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/services/supabase';
import { LucideAngularModule, AlertCircle, User } from 'lucide-angular';

@Component({
  selector: 'app-login-page',
  imports: [LucideAngularModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage implements OnInit {
  public readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly icons = {
    alertCircle: AlertCircle,
    user: User
  };

  async ngOnInit(): Promise<void> {
    await this.supabase.waitForAuthReady();

    if (this.supabase.isLoggedIn()) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
      await this.router.navigateByUrl(returnUrl);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.supabase.signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      this.error.set(msg);
      this.loading.set(false);
    }
  }

  continueAsGuest(): void {
    this.router.navigate(['/analyze']);
  }
}