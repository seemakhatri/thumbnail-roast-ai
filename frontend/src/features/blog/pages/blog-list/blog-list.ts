import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BlogCategory, BlogPostModal, BlogService } from '../../../../core/services/blog';
import { MetaService } from '../../../../core/services/meta';
import { SchemaService } from '../../../../core/services/schema';
import { Supabase } from '../../../../core/services/supabase';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './blog-list.html',
  styleUrl: './blog-list.scss',
})
export class BlogList implements OnInit {
  private readonly blogService = inject(BlogService);
  private readonly meta = inject(MetaService);
  private readonly schema = inject(SchemaService);
  private readonly supabase = inject(Supabase);

  readonly posts = signal<BlogPostModal[]>([]);
  readonly featured = signal<BlogPostModal[]>([]);
  readonly categories = signal<BlogCategory[]>([]);
  readonly loading = signal(true);
  readonly activeCategory = signal<string | null>(null);
  readonly isAdmin = computed(() => this.supabase.currentUser()?.role === 'admin');

  async ngOnInit(): Promise<void> {
    this.meta.set({
      title: 'YouTube Thumbnail Blog — Tips, Research & Guides',
      description:
        'In-depth guides, research, and case studies on YouTube thumbnail optimization, CTR improvement, and thumbnail design best practices.',
      canonical: 'https://thumbnail-roast.com/blog',
    });

    this.schema.clear();
    this.schema.breadcrumb([
      { name: 'Home', url: 'https://thumbnail-roast.com' },
      { name: 'Blog', url: 'https://thumbnail-roast.com/blog' },
    ]);

    const [posts, featured, categories] = await Promise.all([
      this.blogService.getRecentPosts(12),
      this.blogService.getFeaturedPosts(3),
      this.blogService.getCategories(),
    ]);

    this.posts.set(posts);
    this.featured.set(featured);
    this.categories.set(categories);
    this.loading.set(false);
  }

  async filterByCategory(slug: string | null): Promise<void> {
    this.loading.set(true);
    this.activeCategory.set(slug);
    if (!slug) {
      this.posts.set(await this.blogService.getRecentPosts(12));
    } else {
      this.posts.set(await this.blogService.getPostsByCategory(slug));
    }
    this.loading.set(false);
  }

  // ─── Helper: count posts in a category ────────────────────────────────────
  getCategoryCount(slug: string): number {
    return this.posts().filter(p => p.category_slug === slug).length;
  }
}