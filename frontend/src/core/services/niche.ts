import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface NicheTopCreator {
  name: string;
  channel_url?: string;
  note?: string;
}

export interface Niche {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  avg_ctr: number | null;
  avg_score: number | null;
  best_colors: string[] | null;
  best_fonts: string[] | null;
  common_mistakes: string[] | null;
  top_creators: NicheTopCreator[] | null;
  meta_title: string | null;
  meta_description: string | null;
  llm_summary: string | null;
  thumbnail_count: number;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class NicheService {
  private readonly baseUrl = `${environment.supabaseUrl}/rest/v1`;

  private readonly publicHeaders = {
    apikey: environment.supabaseAnonKey,
    Authorization: `Bearer ${environment.supabaseAnonKey}`,
    Accept: 'application/json',
  };

  async getNiches(): Promise<Niche[]> {
    const url = `${this.baseUrl}/niches?select=*&order=name.asc`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) throw new Error('Failed to fetch niches');
    return res.json();
  }

  async getNicheBySlug(slug: string): Promise<Niche | null> {
    const url = `${this.baseUrl}/niches?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) return null;
    const data: Niche[] = await res.json();
    return data[0] ?? null;
  }

  async getOtherNiches(slug: string, limit = 4): Promise<Niche[]> {
    const url = `${this.baseUrl}/niches?slug=neq.${encodeURIComponent(slug)}&select=*&order=thumbnail_count.desc&limit=${limit}`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) return [];
    return res.json();
  }
}