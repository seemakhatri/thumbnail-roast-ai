import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BlogService, BlogPostModal } from '../../../../core/services/blog';
import { MetaService } from '../../../../core/services/meta';
import { SchemaService } from '../../../../core/services/schema';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-blog-post',
  imports: [CommonModule, RouterLink],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.scss',
})
export class BlogPost implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);
  private readonly meta = inject(MetaService);
  private readonly schema = inject(SchemaService);
  
 
  readonly post = signal<BlogPostModal | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
 
  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    const post = await this.blogService.getPostBySlug(slug);
 
    if (!post) {
      this.notFound.set(true);
      this.loading.set(false);
      this.meta.set({ title: 'Post not found', noIndex: true });
      return;
    }
 
    this.post.set(post);
    this.loading.set(false);
 
    // SSR meta
    this.meta.set({
      title: post.meta_title ?? post.title,
      description: post.meta_description ?? post.excerpt,
      ogImage: post.cover_image_url ?? undefined,
      canonical: `https://thumbnailroast.com/blog/${post.slug}`,
    });
 
    // JSON-LD
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
      { name: 'Home', url: 'https://thumbnailroast.com' },
      { name: 'Blog', url: 'https://thumbnailroast.com/blog' },
      { name: post.title, url: `https://thumbnailroast.com/blog/${post.slug}` },
    ]);
    if (post.faq?.length) {
      this.schema.faq(post.faq);
    }
 
    // Increment views (client-side only)
    this.blogService.incrementViews(slug);
  }
 
  // Simple markdown-to-HTML renderer for basic content
  // In production, swap this with ngx-markdown or marked.js
renderContent(content: string): string {
  return content
    .replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<figure class="article-image"><img src="$2" alt="$1" loading="lazy"><figcaption>$1</figcaption></figure>'
    )
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|o|l|b|p|f])/gm, '<p>')
    .replace(/(?<![>])$/gm, '</p>');
}
}
