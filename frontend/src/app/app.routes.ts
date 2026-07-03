// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth-guard';
import { waitlistGuard } from '../core/guards/waitlist-guard';

export const routes: Routes = [
  // ── Waitlist Mode: Landing redirects to waitlist ────────────────────
  {
    path: '',
    loadComponent: () =>
      import('../features/waitlist/waitlist').then((m) => m.Waitlist), // Show waitlist as home
    // When ready to launch, change back to:
    // import('../features/landing/pages/landing-page/landing-page').then((m) => m.LandingPage),
  },
  
  // ── Waitlist page (explicit route) ──────────────────────────────────
  {
    path: 'waitlist',
    loadComponent: () => import('../features/waitlist/waitlist').then((m) => m.Waitlist),
  },

  // ── Blog (keep accessible for SEO) ──────────────────────────────────
  {
    path: 'blog',
    loadComponent: () =>
      import('../features/blog/pages/blog-list/blog-list').then((m) => m.BlogList),
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('../features/blog/pages/blog-post/blog-post').then((m) => m.BlogPost),
    data: { renderMode: 'ssr' }
  },

  // ── Legal pages (keep accessible) ───────────────────────────────────
  {
    path: 'privacy',
    loadComponent: () =>
      import('../features/legal/pages/privacy-page/privacy-page').then((m) => m.PrivacyPage),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('../features/legal/pages/terms-page/terms-page').then((m) => m.TermsPage),
  },

  // ── Protected: Blocked during waitlist ──────────────────────────────
  {
    path: 'analyze',
    canActivate: [waitlistGuard], // Redirects to waitlist
    loadComponent: () =>
      import('../features/analyze/pages/analyze-page/analyze-page').then((m) => m.AnalyzePage),
  },
  {
    path: 'results/:id',
    canActivate: [waitlistGuard],
    loadComponent: () =>
      import('../features/results/pages/results-page/results-page').then((m) => m.ResultsPage),
  },
  {
    path: 'report/:slug',
    canActivate: [waitlistGuard],
    loadComponent: () =>
      import('../features/report/pages/public-report-page/public-report-page').then(
        (m) => m.PublicReportPage,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, waitlistGuard],
    loadComponent: () =>
      import('../features/dashboard/pages/dashboard-page/dashboard-page').then(
        (m) => m.DashboardPage,
      ),
  },
  {
    path: 'compare',
    canActivate: [authGuard, waitlistGuard],
    loadComponent: () =>
      import('../features/compare/pages/compare-page/compare-page').then((m) => m.ComparePage),
  },
  {
    path: 'login',
    canActivate: [waitlistGuard],
    loadComponent: () => import('../features/auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'auth/callback',
    canActivate: [waitlistGuard],
    loadComponent: () =>
      import('../features/auth/callback-page/callback-page').then((m) => m.CallbackPage),
  },
  {
    path: 'auth/youtube-callback',
    canActivate: [waitlistGuard],
    loadComponent: () =>
      import('../features/auth/youtube-callback/youtube-callback').then((m) => m.YoutubeCallback),
  },

  // ── Catch-all: redirect to waitlist ─────────────────────────────────
  {
    path: '**',
    redirectTo: '/waitlist',
  },
];