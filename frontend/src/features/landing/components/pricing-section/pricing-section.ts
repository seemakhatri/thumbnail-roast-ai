import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Check, X, LucideAngularModule } from 'lucide-angular';
import { Checkout, PricingPlan } from '../../../../core/services/checkout';
import { Supabase } from '../../../../core/services/supabase';

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: PricingPlan;
  features: PlanFeature[];
}

const PLAN_RANK: Record<PricingPlan, number> = {
  free: 0,
  creator: 1,
  business: 2,
  agency: 3,
};

@Component({
  selector: 'app-pricing-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './pricing-section.html',
  styleUrl: './pricing-section.scss',
})
export class PricingSection {
  readonly checkout = inject(Checkout);
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);

  readonly icons = { check: Check, x: X };

  readonly currentPlan = computed(() => this.supabase.userPlan() as PricingPlan);
  readonly isLoggedIn = computed(() => this.supabase.isLoggedIn());

  readonly currentSlide = signal(0);

  getButtonLabel(planId: PricingPlan): string {
    const current = this.currentPlan();

    if (current === planId) {
      return '✓ Current Plan';
    }

    if (PLAN_RANK[current] > PLAN_RANK[planId]) {
      return 'Already Included';
    }

    switch (planId) {
      case 'free':
        return 'Get Started Free';
      case 'creator':
      case 'business':
      case 'agency':
        return 'Upgrade →';
      default:
        return 'Select Plan';
    }
  }

  getButtonStyle(planId: PricingPlan): 'current' | 'upgrade' | 'included' | 'free' {
    const current = this.currentPlan();

    if (current === planId) return 'current';
    if (PLAN_RANK[current] > PLAN_RANK[planId]) return 'included';
    if (planId === 'free') return 'free';
    return 'upgrade';
  }

  isButtonDisabled(planId: PricingPlan): boolean {
    const current = this.currentPlan();
    return PLAN_RANK[current] >= PLAN_RANK[planId];
  }

  selectPlan(planId: PricingPlan): void {
    const current = this.currentPlan();

    if (PLAN_RANK[current] >= PLAN_RANK[planId]) {
      if (planId === 'free') {
        document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        void this.router.navigate(['/dashboard']);
      }
      return;
    }

    if (planId === 'free') {
      document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (!this.isLoggedIn()) {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/pricing' },
      });
      return;
    }

    void this.checkout.startCheckout(planId);
  }

  nextSlide(): void {
    if (this.currentSlide() < 3) this.currentSlide.update(v => v + 1);
  }

  prevSlide(): void {
    if (this.currentSlide() > 0) this.currentSlide.update(v => v - 1);
  }

  goToSlide(index: number): void {
    this.currentSlide.set(index);
  }

  readonly plans: Plan[] = [
    {
      id: 'free',
      features: [
        { text: '3 analyses per month', included: true },
        { text: '8-dimension score', included: true },
        { text: 'Roast report + share link', included: true },
        { text: 'Top 3 recommendations', included: true },
        { text: 'History & tracking', included: false },
        { text: 'Competitor intelligence', included: false },
      ],
    },
    {
      id: 'creator',
      features: [
        { text: '50 analyses per month', included: true },
        { text: 'Full 8-dimension scoring', included: true },
        { text: 'Unlimited recommendations', included: true },
        { text: 'Historical tracking', included: true },
        { text: 'Competitor thumbnail intel', included: true },
        { text: 'A/B variant scoring', included: true },
      ],
    },
    {
      id: 'business',
      features: [
        { text: '200 analyses per month', included: true },
        { text: 'Everything in Creator', included: true },
        { text: 'Team collaboration', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'Priority support', included: true },
        { text: 'Export reports (PDF/CSV)', included: true },
      ],
    },
    {
      id: 'agency',
      features: [
        { text: '500 analyses per month', included: true },
        { text: '5 team seats', included: true },
        { text: 'Brand consistency scoring', included: true },
        { text: 'API access', included: true },
        { text: 'White-label reports', included: true },
        { text: '24/7 priority support', included: true },
      ],
    },
  ];
}