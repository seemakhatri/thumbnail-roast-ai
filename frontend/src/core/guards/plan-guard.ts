import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const planGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);

  await supabase.waitForAuthReady();

  const user = supabase.currentUser();
  if (!user) {
    return router.createUrlTree(['/login']);
  }

  const plan = user.plan || 'free';
  if (plan === 'free') {
    return router.createUrlTree(['/pricing'], { queryParams: { upgrade: 'compare' } });
  }

  return true;
};