import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class SchemaService {
  private readonly doc = inject(DOCUMENT);

  private inject(schema: Record<string, unknown>): void {
    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'true');
    script.text = JSON.stringify(schema, null, 2);
    this.doc.head.appendChild(script);
  }

  /** Remove all injected schemas (call on route change to prevent duplicates) */
  clear(): void {
    this.doc.head
      .querySelectorAll('script[data-schema]')
      .forEach((el) => el.remove());
  }

  organization(): void {
    this.inject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Thumbnail Roast',
      url: 'https://thumbnailroast.com',
      logo: 'https://thumbnail-roast.com/assets/logo.png',
      sameAs: [],
    });
  }

  softwareApplication(): void {
    this.inject({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Thumbnail Roast',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: 'https://thumbnailroast.com',
      description:
        'AI-powered YouTube thumbnail analyzer. Upload a thumbnail and receive an AI score across CTR potential, readability, contrast, emotion, and more.',
      offers: [
        { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free plan — 3 analyses/month' },
        { '@type': 'Offer', price: '19', priceCurrency: 'USD', name: 'Creator plan — 50 analyses/month' },
        { '@type': 'Offer', price: '49', priceCurrency: 'USD', name: 'Agency plan — unlimited analyses' },
      ],
    });
  }

  article(post: {
    title: string;
    excerpt: string;
    slug: string;
    author_name?: string;
    published_at: string;
    updated_at?: string;
    cover_image_url?: string;
  }): void {
    this.inject({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt,
      url: `https://thumbnail-roast.com/blog/${post.slug}`,
      image: post.cover_image_url ?? 'https://thumbnail-roast.com/assets/og-default.jpg',
      author: {
        '@type': 'Person',
        name: post.author_name ?? 'Thumbnail Roast Team',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Thumbnail Roast',
        url: 'https://thumbnailroast.com',
      },
      datePublished: post.published_at,
      dateModified: post.updated_at ?? post.published_at,
    });
  }

  faq(items: { question: string; answer: string }[]): void {
    if (!items?.length) return;
    this.inject({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });
  }

  breadcrumb(items: { name: string; url: string }[]): void {
    this.inject({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  definedTerm(term: { term: string; definition: string; slug: string }): void {
    this.inject({
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: term.term,
      description: term.definition,
      url: `https://thumbnail-roast.com/glossary/${term.slug}`,
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        name: 'YouTube Thumbnail Optimization Glossary',
        url: 'https://thumbnail-roast.com/glossary',
      },
    });
  }

  howTo(tool: { name: string; description: string; slug: string; steps: string[] }): void {
    this.inject({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: tool.name,
      description: tool.description,
      url: `https://thumbnail-roast.com/tools/${tool.slug}`,
      step: tool.steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        text: s,
      })),
    });
  }
}