import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

export interface BlogPostModal {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  author_name: string | null;
  author_slug: string | null;
  category_name: string | null;
  category_slug: string | null;
  meta_title: string | null;
  meta_description: string | null;
  llm_summary: string | null;
  faq: { question: string; answer: string }[] | null;
  read_time_minutes: number | null;
  views: number;
  published_at: string;
  updated_at: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface BlogPostPayload {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url?: string | null;
  author_id?: string | null;
  category_id?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  llm_summary?: string | null;
  faq?: { question: string; answer: string }[] | null;
  read_time_minutes?: number | null;
  status?: 'draft' | 'published';
  featured?: boolean;
  published_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly baseUrl = `${environment.supabaseUrl}/rest/v1`;

  private readonly publicHeaders = {
    apikey: environment.supabaseAnonKey,
    Authorization: `Bearer ${environment.supabaseAnonKey}`,
    Accept: 'application/json',
  };

  // ─── Admin headers ──────────────────────────────────────────────────────
  private get adminHeaders() {
    if (!environment.supabaseServiceRoleKey) {
      throw new Error('Service role key is missing in environment. Add supabaseServiceRoleKey.');
    }
    return {
      apikey: environment.supabaseServiceRoleKey,
      Authorization: `Bearer ${environment.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    };
  }

  // ─── Public read ────────────────────────────────────────────────────────

  async getRecentPosts(limit = 12): Promise<BlogPostModal[]> {
    const url =
      `${this.baseUrl}/v_blog_posts?select=*` +
      `&order=published_at.desc&limit=${limit}`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) throw new Error('Failed to fetch posts');
    return res.json();
  }

  async getPostsByCategory(categorySlug: string, limit = 12): Promise<BlogPostModal[]> {
    const url =
      `${this.baseUrl}/v_blog_posts?select=*` +
      `&category_slug=eq.${encodeURIComponent(categorySlug)}` +
      `&order=published_at.desc&limit=${limit}`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) throw new Error('Failed to fetch posts');
    return res.json();
  }

  async getPostBySlug(slug: string): Promise<BlogPostModal | null> {
    const url =
      `${this.baseUrl}/v_blog_posts?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) return null;
    const data: BlogPostModal[] = await res.json();
    return data[0] ?? null;
  }

  async getFeaturedPosts(limit = 3): Promise<BlogPostModal[]> {
    const url =
      `${this.baseUrl}/v_blog_posts?select=*&featured=eq.true` +
      `&order=published_at.desc&limit=${limit}`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) return [];
    return res.json();
  }

  async getCategories(): Promise<BlogCategory[]> {
    const url = `${this.baseUrl}/categories?select=*&order=sort_order.asc`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) return [];
    return res.json();
  }

  async incrementViews(slug: string): Promise<void> {
    fetch(`${this.baseUrl}/rpc/increment_blog_views`, {
      method: 'POST',
      headers: { ...this.publicHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_slug: slug }),
    }).catch(() => {});
  }

  // ─── Admin write ────────────────────────────────────────────────────────

  async createPost(payload: BlogPostPayload): Promise<BlogPostModal> {
    const url = `${this.baseUrl}/blog_posts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.adminHeaders,
      body: JSON.stringify({
        ...payload,
        published_at: payload.status === 'published' ? new Date().toISOString() : null,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create post: ${err}`);
    }
    const data = await res.json();
    return data[0] ?? data;
  }

  async updatePost(id: string, updates: Partial<BlogPostPayload>): Promise<BlogPostModal> {
    const url = `${this.baseUrl}/blog_posts?id=eq.${id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.adminHeaders,
      body: JSON.stringify({
        ...updates,
        published_at: updates.status === 'published' ? new Date().toISOString() : undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to update post: ${err}`);
    }
    const data = await res.json();
    return data[0] ?? data;
  }

  // ─── Admin read (bypasses status filter) ───────────────────────────────

  async getPostBySlugAdmin(slug: string): Promise<BlogPostModal | null> {
    const url = `${this.baseUrl}/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;
    const res = await fetch(url, { headers: this.adminHeaders });
    if (!res.ok) return null;
    const data = await res.json();
    return data[0] ?? null;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  readTime(content: string): number {
    const words = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  async getRelatedPosts(slug: string, categorySlug: string, limit = 3): Promise<BlogPostModal[]> {
  const url =
    `${this.baseUrl}/v_blog_posts?select=*` +
    `&category_slug=eq.${encodeURIComponent(categorySlug)}` +
    `&slug=neq.${encodeURIComponent(slug)}` +
    `&order=published_at.desc&limit=${limit}`;
  const res = await fetch(url, { headers: this.publicHeaders });
  if (!res.ok) return [];
  return res.json();
}
}