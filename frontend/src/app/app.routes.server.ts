import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
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
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];