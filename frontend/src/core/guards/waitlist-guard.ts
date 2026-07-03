import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const waitlistGuard = () => {
  const router = inject(Router);
  
  const WAITLIST_MODE = true;
  
  if (WAITLIST_MODE) {
    return router.parseUrl('/waitlist');
  }
  
  return true;
};