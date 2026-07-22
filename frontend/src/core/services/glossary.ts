import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  definition: string;
  extended_content: string | null;
  related_terms: string[] | null;
  meta_description: string | null;
  llm_definition: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class GlossaryService {
  private readonly baseUrl = `${environment.supabaseUrl}/rest/v1`;

  private readonly publicHeaders = {
    apikey: environment.supabaseAnonKey,
    Authorization: `Bearer ${environment.supabaseAnonKey}`,
    Accept: 'application/json',
  };

  async getTerms(): Promise<GlossaryTerm[]> {
    const url = `${this.baseUrl}/glossary_terms?select=*&order=term.asc`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) throw new Error('Failed to fetch glossary terms');
    return res.json();
  }

  async getTermBySlug(slug: string): Promise<GlossaryTerm | null> {
    const url = `${this.baseUrl}/glossary_terms?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) return null;
    const data: GlossaryTerm[] = await res.json();
    return data[0] ?? null;
  }

  async getRelatedTerms(term: GlossaryTerm, limit = 4): Promise<GlossaryTerm[]> {
    if (!term.related_terms?.length) return [];
    const list = term.related_terms.slice(0, limit).map((t) => `"${t.replace(/"/g, '')}"`).join(',');
    const url = `${this.baseUrl}/glossary_terms?term=in.(${list})&select=*&limit=${limit}`;
    const res = await fetch(url, { headers: this.publicHeaders });
    if (!res.ok) return [];
    return res.json();
  }
}