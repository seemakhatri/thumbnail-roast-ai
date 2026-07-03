import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import {
  provideHttpClient,
  withFetch
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions
} from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
   provideHttpClient(withFetch()),

    provideZoneChangeDetection({
      eventCoalescing: true
    }),
    provideAnimations(),

    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions()
    )
  ]
};