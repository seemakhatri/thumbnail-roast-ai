// services/ctr.ts — CREATE THIS FILE

import { computed, inject, Injectable, signal } from '@angular/core';
import { Gemini } from './gemini';
import { CtrPair } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class Ctr {
  private readonly gemini = inject(Gemini);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly pairs   = signal<CtrPair[]>([]);
  readonly insight = signal<string | null>(null);

  // Enough data to show the correlation?
  readonly hasEnoughData = computed(() => this.pairs().length >= 5);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.gemini.getCtrCorrelation();
      this.pairs.set(result.pairs);
      this.insight.set(result.insight.message);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load CTR data');
    } finally {
      this.loading.set(false);
    }
  }
}