import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const BASE_TITLE = 'Thumbnail Roast';
const BASE_URL = 'https://thumbnailroast.com';
const DEFAULT_OG_IMAGE = `${BASE_URL}/assets/og-default.jpg`;
const DEFAULT_DESCRIPTION =
  'AI-powered YouTube thumbnail analyzer. Get an instant score, roast, and actionable improvements for your thumbnails.';

export interface PageMeta {
  title: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
  noIndex?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MetaService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  set(opts: PageMeta): void {
    const fullTitle = opts.title.includes(BASE_TITLE)
      ? opts.title
      : `${opts.title} — ${BASE_TITLE}`;
    const desc = opts.description ?? DEFAULT_DESCRIPTION;
    const img = opts.ogImage ?? DEFAULT_OG_IMAGE;
    const url = opts.canonical ?? BASE_URL;

    this.title.setTitle(fullTitle);

    this.meta.updateTag({ name: 'description', content: desc });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: desc });
    this.meta.updateTag({ property: 'og:image', content: img });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    this.meta.updateTag({ name: 'twitter:image', content: img });

    if (opts.noIndex) {
      this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
    } else {
      this.meta.updateTag({ name: 'robots', content: 'index,follow' });
    }
  }
}