import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  await supabase.waitForAuthReady();

  if (supabase.isLoggedIn()) {
    return true;
  }

  const returnUrl = isPlatformBrowser(platformId)
    ? window.location.pathname + window.location.search
    : '/dashboard';

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl },
  });
};