import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);
  await supabase.waitForAuthReady();
  const user = supabase.currentUser();

  if (!user || user.role !== 'admin') {
    return router.createUrlTree(['/']);
  }
  return true;
};