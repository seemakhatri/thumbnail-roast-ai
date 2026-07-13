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
    console.log('[LoginPage] ngOnInit - Starting initialization');
    console.log('[LoginPage] Current URL:', window.location.href);
    console.log('[LoginPage] Query params:', this.route.snapshot.queryParamMap);
    
    try {
      console.log('[LoginPage] Waiting for auth to be ready...');
      await this.supabase.waitForAuthReady();
      console.log('[LoginPage] Auth is ready');
      
      const isLoggedIn = this.supabase.isLoggedIn();
      console.log('[LoginPage] Is user logged in?', isLoggedIn);
      
      if (isLoggedIn) {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        console.log('[LoginPage] User already logged in, redirecting to:', returnUrl);
        await this.router.navigateByUrl(returnUrl);
        console.log('[LoginPage] Redirect successful');
      } else {
        console.log('[LoginPage] User not logged in, showing login form');
      }
    } catch (error) {
      console.error('[LoginPage] Error during initialization:', error);
      this.error.set('Failed to initialize authentication');
    }
  }

  async signInWithGoogle(): Promise<void> {
    console.log('[LoginPage] signInWithGoogle - Starting Google sign-in');
    console.log('[LoginPage] Current loading state:', this.loading());
    
    this.loading.set(true);
    this.error.set(null);
    console.log('[LoginPage] Loading set to true, error cleared');
    
    try {
      console.log('[LoginPage] Calling supabase.signInWithGoogle()...');
      console.log('[LoginPage] Current origin:', window.location.origin);
      
      const result = await this.supabase.signInWithGoogle();
      console.log('[LoginPage] signInWithGoogle result:', result);
      
      // Note: The page will redirect to Google, so this code might not execute
      console.log('[LoginPage] Sign-in initiated successfully');
      console.log('[LoginPage] If you see this, the redirect didn\'t happen immediately');
      
    } catch (err: unknown) {
      console.error('[LoginPage] Sign-in error:', err);
      console.error('[LoginPage] Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : 'No message',
        stack: err instanceof Error ? err.stack : 'No stack'
      });
      
      const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      console.log('[LoginPage] Setting error message:', msg);
      this.error.set(msg);
      this.loading.set(false);
    }
  }

  continueAsGuest(): void {
    console.log('[LoginPage] continueAsGuest - User continuing as guest');
    console.log('[LoginPage] Navigating to /analyze');
    this.router.navigate(['/analyze']);
    console.log('[LoginPage] Navigation to /analyze initiated');
  }
}