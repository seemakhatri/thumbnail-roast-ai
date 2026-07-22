import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth-guard';
import { planGuard } from '../core/guards/plan-guard';
import { adminGuard } from '../core/guards/admin.guard';

export const routes: Routes = [
  // ── Landing ─────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('../features/landing/pages/landing-page/landing-page').then((m) => m.LandingPage),
  },

  // Blog

  {
    path: 'blog',
    loadComponent: () =>
      import('../features/blog/pages/blog-list/blog-list').then((m) => m.BlogList),
  },

  {
    path: 'blog/create',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('../features/blog/pages/blog-editor/blog-editor').then((m) => m.BlogEditor),
  },

  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('../features/blog/pages/blog-post/blog-post').then((m) => m.BlogPost),
    data: { renderMode: 'ssr' },
  },

  // ── Legal ───────────────────────────────────────────────────────────
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

  // ── Pricing ─────────────────────────────────────────────────────────
  {
    path: 'pricing',
    loadComponent: () => import('../features/pricing-page/pricing-page').then((m) => m.PricingPage),
  },

  // ── Glossary ────────────────────────────────────────────────────────
  {
    path: 'glossary',
    loadComponent: () =>
      import('../features/glossary/pages/glossary-index/glossary-index').then(
        (m) => m.GlossaryIndex,
      ),
  },
  {
    path: 'glossary/:slug',
    loadComponent: () =>
      import('../features/glossary/pages/term-page/term-page').then((m) => m.TermPage),
  },

  // ── Niches ──────────────────────────────────────────────────────────
  {
    path: 'niches',
    loadComponent: () => import('../features/niches/niche-hub/niche-hub').then((m) => m.NicheHub),
  },
  {
    path: 'niches/:slug',
    loadComponent: () =>
      import('../features/niches/niche-page/niche-page').then((m) => m.NichePage),
  },

  // ── Free Tools ──────────────────────────────────────────────────────
  {
    path: 'tools/ctr-calculator',
    loadComponent: () =>
      import('../features/tools/ctr-calculator/ctr-calculator').then((m) => m.CtrCalculator),
  },

  // ── Public Pages ────────────────────────────────────────────────────
  {
    path: 'analyze',
    loadComponent: () =>
      import('../features/analyze/pages/analyze-page/analyze-page').then((m) => m.AnalyzePage),
  },
  {
    path: 'results/:id',
    loadComponent: () =>
      import('../features/results/pages/results-page/results-page').then((m) => m.ResultsPage),
  },
  {
    path: 'report/:slug',
    loadComponent: () =>
      import('../features/report/pages/public-report-page/public-report-page').then(
        (m) => m.PublicReportPage,
      ),
  },

  // ── Auth ────────────────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('../features/auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('../features/auth/callback-page/callback-page').then((m) => m.CallbackPage),
  },
  {
    path: 'auth/youtube-callback',
    loadComponent: () =>
      import('../features/auth/youtube-callback/youtube-callback').then((m) => m.YoutubeCallback),
  },

  // ── Protected ───────────────────────────────────────────────────────
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../features/dashboard/pages/dashboard-page/dashboard-page').then(
        (m) => m.DashboardPage,
      ),
  },
  {
    path: 'compare',
    canActivate: [authGuard, planGuard],
    loadComponent: () =>
      import('../features/compare/pages/compare-page/compare-page').then((m) => m.ComparePage),
  },
  {
    path: 'research',
    canActivate: [authGuard, planGuard],
    loadComponent: () =>
      import('../features/research/research-page/research-page').then((m) => m.ResearchPage),
  },

  {
    path: 'channel-audit',
    canActivate: [authGuard, planGuard],
    loadComponent: () =>
      import('../features/channel-audit/channel-audit/channel-audit').then((m) => m.ChannelAudit),
  },
  // waitlist route removed: you have real users now, a waitlist is a dead end.
  // The component file is untouched at features/waitlist if you ever need it again.

  // ── 404 ─────────────────────────────────────────────────────────────
  {
    path: '**',
    loadComponent: () =>
      import('../features/not-found-page/not-found-page').then((m) => m.NotFoundPage),
  },
];
