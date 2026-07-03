import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  console.log('Guard started');

  await supabase.waitForAuthReady();

  console.log('Auth loading finished');
  console.log('Current user:', supabase.currentUser());
  console.log('Logged in:', supabase.isLoggedIn());

  if (supabase.isLoggedIn()) {
    return true;
  }

  console.log('Redirecting to login');

  const returnUrl = isPlatformBrowser(platformId)
    ? window.location.pathname + window.location.search
    : '/dashboard';

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl },
  });
};