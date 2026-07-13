import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Supabase } from './supabase';

export type PricingPlan = 'free' | 'creator' | 'business' | 'agency';

const PLAN_RANK: Record<PricingPlan, number> = {
  free: 0,
  creator: 1,
  business: 2,
  agency: 3,
};

// Plan limits - keep in sync with backend
export const PLAN_LIMITS: Record<PricingPlan, number> = {
  free: 3,
  creator: 50,
  business: 200,
  agency: 500,
};

@Injectable({
  providedIn: 'root',
})
export class Checkout {
  private readonly supabase = inject(Supabase);

readonly loadingPlan = signal<PricingPlan | null>(null);
readonly error = signal<string | null>(null);

isLoading(plan: PricingPlan): boolean {
  return this.loadingPlan() === plan;
}
  async startCheckout(plan: PricingPlan): Promise<void> {
    if (plan === 'free') return;

    // ── Plan rank guard ───────────────────────────────────────────────────
    // Prevent purchasing a plan the user is already on or below
    const currentPlan = this.supabase.userPlan() as PricingPlan;
    if (PLAN_RANK[currentPlan] >= PLAN_RANK[plan]) {
      // Already on this plan or higher — nothing to do
      return;
    }

this.loadingPlan.set(plan);
    this.error.set(null);

    try {
      // ── Get JWT from session ────────────────────────────────────────────
      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        this.error.set('Please sign in before upgrading.');
        return;
      }

      // ── Call edge function ──────────────────────────────────────────────
      const edgeFunctionUrl = `${environment.supabaseUrl}/functions/v1/create-checkout`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseAnonKey,
          'Authorization': `Bearer ${accessToken}`,
        },
        // Only send plan — userId is derived from JWT on the server
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        this.error.set(
          (errData as { error?: string }).error ??
          'Unable to start checkout. Please try again.'
        );
        return;
      }

      const data = (await response.json()) as { url?: string };

      if (data?.url) {
        window.location.href = data.url;
      } else {
        this.error.set('No checkout URL returned. Please try again.');
      }

    } catch {
      this.error.set('Checkout service unavailable. Please try again.');
    } finally {
  this.loadingPlan.set(null);
}
  }
}