import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supabase } from './supabase';
import { ThumbnailReport } from '../models/report.model';
import { CompareVerdict, RecurringPattern } from '../models/compare.model';


export interface ComparisonApiResult {
  thumbnails: (ThumbnailReport & { label: 'A' | 'B' | 'C' })[];
  winner: string | null;
  verdict: CompareVerdict;
  recurringPattern: RecurringPattern | null;
}

@Injectable({ providedIn: 'root' })
export class CompareService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(Supabase);

  private readonly edgeFunctionsUrl = `${environment.supabaseUrl}/functions/v1`;

  // ── Slots — the user picks up to 3 reports ─────────────────────────────
  readonly slotA = signal<ThumbnailReport | null>(null);
  readonly slotB = signal<ThumbnailReport | null>(null);
  readonly slotC = signal<ThumbnailReport | null>(null); // optional

  // ── Result state ───────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<ComparisonApiResult | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────
  readonly canCompare = computed(() => !!this.slotA() && !!this.slotB());
  readonly hasResult = computed(() => !!this.result());

  readonly winnerReport = computed(() => {
    const r = this.result();
    if (!r || !r.winner) return null;
    return r.thumbnails.find((t) => t.id === r.winner) ?? null;
  });

  readonly isTie = computed(() => this.result()?.verdict?.overallWinner === 'tie');

  // ── Run comparison ─────────────────────────────────────────────────────
  async compare(): Promise<void> {
    const a = this.slotA();
    const b = this.slotB();
    if (!a || !b) {
      this.error.set('Select at least two thumbnails to compare');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    try {
      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');

      const body: Record<string, string> = {
        thumbnailA: a.id,
        thumbnailB: b.id,
      };
      const c = this.slotC();
      if (c) body['thumbnailC'] = c.id;

      const res = await firstValueFrom(
        this.http.post<ComparisonApiResult>(
          `${this.edgeFunctionsUrl}/compare-thumbnails`,
          body,
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabaseAnonKey,
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      this.result.set(res);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Comparison failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────
  reset(): void {
    this.slotA.set(null);
    this.slotB.set(null);
    this.slotC.set(null);
    this.result.set(null);
    this.error.set(null);
  }
}