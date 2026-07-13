import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';


export const waitlistGuard = () => {
  const router = inject(Router);

  if (environment.waitlistMode) {
    return router.parseUrl('/waitlist');
  }

  return true;
};