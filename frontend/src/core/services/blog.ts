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

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly baseUrl = `${environment.supabaseUrl}/rest/v1`;
  private readonly headers = {
    apikey: environment.supabaseAnonKey,
    Authorization: `Bearer ${environment.supabaseAnonKey}`,
    Accept: 'application/json',
  };

  async getRecentPosts(limit = 12): Promise<BlogPostModal[]> {
    const url =
      `${this.baseUrl}/v_blog_posts?select=*` +
      `&order=published_at.desc&limit=${limit}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error('Failed to fetch posts');
    return res.json();
  }

  async getPostsByCategory(categorySlug: string, limit = 12): Promise<BlogPostModal[]> {
    const url =
      `${this.baseUrl}/v_blog_posts?select=*` +
      `&category_slug=eq.${encodeURIComponent(categorySlug)}` +
      `&order=published_at.desc&limit=${limit}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error('Failed to fetch posts');
    return res.json();
  }

  async getPostBySlug(slug: string): Promise<BlogPostModal | null> {
    const url =
      `${this.baseUrl}/v_blog_posts?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return null;
    const data: BlogPostModal[] = await res.json();
    return data[0] ?? null;
  }

  async getFeaturedPosts(limit = 3): Promise<BlogPostModal[]> {
    const url =
      `${this.baseUrl}/v_blog_posts?select=*&featured=eq.true` +
      `&order=published_at.desc&limit=${limit}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return [];
    return res.json();
  }

  async getCategories(): Promise<BlogCategory[]> {
    const url = `${this.baseUrl}/categories?select=*&order=sort_order.asc`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return [];
    return res.json();
  }

  async incrementViews(slug: string): Promise<void> {
    // Fire and forget — increment views via RPC
    fetch(`${this.baseUrl}/rpc/increment_blog_views`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_slug: slug }),
    }).catch(() => {});
  }

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
}