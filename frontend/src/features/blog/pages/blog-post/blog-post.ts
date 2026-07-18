import {
  Component,
  HostListener,
  inject,
  OnInit,
  signal,
  computed,
  AfterViewInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogService, BlogPostModal } from '../../../../core/services/blog';
import { MetaService } from '../../../../core/services/meta';
import { SchemaService } from '../../../../core/services/schema';
import { CommonModule } from '@angular/common';
import { Supabase } from '../../../../core/services/supabase';
import { LucideAngularModule, Share2, Twitter, Link2, Flame } from 'lucide-angular';
import { Toast } from '../../../../core/services/toast';

interface TocItem {
  id: string;
  text: string;
}

@Component({
  selector: 'app-blog-post',
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.scss',
})
export class BlogPost implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);
  private readonly meta = inject(MetaService);
  private readonly schema = inject(SchemaService);
  private readonly supabase = inject(Supabase);
  private readonly toast = inject(Toast);

  readonly post = signal<BlogPostModal | null>(null);
  readonly relatedPosts = signal<BlogPostModal[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly renderedContent = signal<string>('');
  readonly toc = signal<TocItem[]>([]);
  readonly progress = signal(0);
  readonly activeTocId = signal<string | null>(null);

  readonly shareUrl = computed(() => {
    const p = this.post();
    if (!p) return '';
    return `https://thumbnail-roast.com/blog/${p.slug}`;
  });

  readonly icons = {
    share: Share2,
    twitter: Twitter,
    link: Link2,
    flame: Flame,
  };

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    const user = this.supabase.currentUser();
    const isAdmin = user?.role === 'admin';

    let post: BlogPostModal | null = null;
    if (isAdmin) {
      post = await this.blogService.getPostBySlugAdmin(slug);
    } else {
      post = await this.blogService.getPostBySlug(slug);
    }

    if (!post) {
      this.notFound.set(true);
      this.loading.set(false);
      this.meta.set({ title: 'Post not found', noIndex: true });
      return;
    }

    const { html, toc } = this.processContent(post.content);

    this.post.set(post);
    this.renderedContent.set(html);
    this.toc.set(toc);
    this.loading.set(false);

    if (post.category_slug) {
      const related = await this.blogService.getRelatedPosts(post.slug, post.category_slug);
      this.relatedPosts.set(related);
    }

    this.meta.set({
      title: post.meta_title ?? post.title,
      description: post.meta_description ?? post.excerpt,
      ogImage: post.cover_image_url ?? undefined,
      canonical: `https://thumbnail-roast.com/blog/${post.slug}`,
    });

    this.schema.clear();
    this.schema.article({
      title: post.title,
      excerpt: post.excerpt,
      slug: post.slug,
      author_name: post.author_name ?? undefined,
      published_at: post.published_at,
      updated_at: post.updated_at,
      cover_image_url: post.cover_image_url ?? undefined,
    });
    this.schema.breadcrumb([
      { name: 'Home', url: 'https://thumbnail-roast.com' },
      { name: 'Blog', url: 'https://thumbnail-roast.com/blog' },
      { name: post.title, url: `https://thumbnail-roast.com/blog/${post.slug}` },
    ]);
    if (post.faq?.length) {
      this.schema.faq(post.faq);
    }

    this.blogService.incrementViews(slug);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateActiveToc(), 200);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;
    this.progress.set(scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0);
    this.updateActiveToc();
  }

  private updateActiveToc(): void {
    // This still uses the `id` – but the scroll uses text, so it's fine
    const headings = this.toc()
      .map((item) => document.getElementById(item.id))
      .filter((el) => el !== null) as HTMLElement[];
    let activeId: string | null = null;
    for (const el of headings) {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.4) {
        activeId = el.id;
      } else {
        break;
      }
    }
    this.activeTocId.set(activeId);
  }

  // ─── FIXED: scroll by text, not by ID ────────────────────────────────────
  scrollTo(item: TocItem): void {
    const headings = document.querySelectorAll('h2');
    for (const h of headings) {
      if (h.textContent?.trim() === item.text.trim()) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    console.warn('Heading not found:', item.text);
  }

  isActive(id: string): boolean {
    return this.activeTocId() === id;
  }

  copyLink(): void {
    const url = this.shareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Link copied to clipboard!');
    });
  }

  shareOnTwitter(): void {
    const post = this.post();
    if (!post) return;
    const text = encodeURIComponent(`📖 "${post.title}" by ThumbnailRoast`);
    const url = encodeURIComponent(this.shareUrl());
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private processContent(content: string): { html: string; toc: TocItem[] } {
    if (!content) return { html: '', toc: [] };

    let html = content;

    // ── Tables ────────────────────────────────────────────────────────────
    const tableRegex = /((?:^\|.*\|$\n?)+)/gm;
    html = html.replace(tableRegex, (tableBlock: string) => {
      const lines = tableBlock
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      if (lines.length < 2) return tableBlock;
      const hasSeparator = lines.some((line) => /^[\s\|:-]+$/.test(line.replace(/\|/g, '').trim()));
      if (!hasSeparator) return tableBlock;
      let headerRow = '',
        bodyRows = '',
        isHeader = true;
      for (const line of lines) {
        if (/^[\s\|:-]+$/.test(line.replace(/\|/g, '').trim())) {
          isHeader = false;
          continue;
        }
        const cells = line
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c !== '');
        if (cells.length === 0) continue;
        if (isHeader) {
          headerRow = `<thead><tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr></thead>`;
        } else {
          bodyRows += `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
        }
      }
      if (!headerRow && bodyRows) {
        const firstRow = bodyRows.split('</tr>')[0] + '</tr>';
        headerRow = `<thead>${firstRow.replace(/td>/g, 'th>')}</thead>`;
        bodyRows = bodyRows.replace(firstRow, '');
      }
      return `<table>${headerRow}<tbody>${bodyRows}</tbody></table>`;
    });

    html = html.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<figure class="article-image"><img src="$2" alt="$1" loading="lazy"><figcaption>$1</figcaption></figure>',
    );

    // ── Headings ──────────────────────────────────────────────────────────
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    const toc: TocItem[] = [];
    html = html.replace(/<h2>(.*?)<\/h2>/g, (_match, text) => {
      const id = this.slugify(text);
      toc.push({ id, text });
      return `<h2 id="${id}">${text}</h2>`;
    });

    // ── Bold & Italic ────────────────────────────────────────────────────
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    html = html.replace(/(?:^|\n)[\-\*]\s+(.+)(?:\n[\-\*]\s+.+)*/g, (match) => {
      const items = match
        .split('\n')
        .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('*'));
      const listHtml = items
        .map((item) => `<li>${item.replace(/^[\-\*]\s+/, '').trim()}</li>`)
        .join('');
      return `<ul>${listHtml}</ul>`;
    });

    html = html.replace(/(?:^|\n)\d+\.\s+(.+)(?:\n\d+\.\s+.+)*/g, (match) => {
      const items = match.split('\n').filter((line) => /^\d+\./.test(line.trim()));
      const listHtml = items
        .map((item) => `<li>${item.replace(/^\d+\.\s+/, '').trim()}</li>`)
        .join('');
      return `<ol>${listHtml}</ol>`;
    });

    html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

    const blockTags = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'table',
      'blockquote',
      'figure',
    ];
    const blockTagRegex = new RegExp(`</?(${blockTags.join('|')})[^>]*>`, 'g');

    const parts = html.split(/\n\n/);
    html = parts
      .map((part) => {
        if (blockTagRegex.test(part)) return part;
        if (!part.trim()) return '';
        if (!/^<[a-z]/.test(part.trim())) return `<p>${part.trim()}</p>`;
        return part;
      })
      .join('');

    return { html, toc };
  }
}
