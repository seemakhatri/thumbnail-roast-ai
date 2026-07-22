import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'blog',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'privacy',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'terms',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'waitlist',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'results/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'report/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'dashboard',
    renderMode: RenderMode.Server,
  },
  {
    path: 'analyze',
    renderMode: RenderMode.Server,
  },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'compare',
    renderMode: RenderMode.Server,
  },
  {
    path: 'research',
    renderMode: RenderMode.Server,
  },
  {
    path: 'channel-audit',
    renderMode: RenderMode.Server,
  },
  {
    path: 'pricing',
    renderMode: RenderMode.Server,
  },
  {
    path: 'login',
    renderMode: RenderMode.Server,
  },
  {
    path: 'auth/callback',
    renderMode: RenderMode.Server,
  },
  {
    path: 'auth/youtube-callback',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];