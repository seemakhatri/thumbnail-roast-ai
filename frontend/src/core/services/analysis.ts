import { computed, inject, Injectable, signal } from '@angular/core';
import { ThumbnailReport } from '../models/report.model';
import { Upload } from './upload';
import { Gemini } from './gemini';
import { Supabase } from './supabase';
import { Dashboard } from './dashboard';

export type AnalysisStep = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

export interface AnalysisState {
  step: AnalysisStep;
  progress: number;
  statusMessage: string;
  previewUrl: string | null;
  report: ThumbnailReport | null;
  error: string | null;
}

const INITIAL_STATE: AnalysisState = {
  step: 'idle',
  progress: 0,
  statusMessage: '',
  previewUrl: null,
  report: null,
  error: null,
};

const LOADING_MESSAGES: string[] = [
  'Uploading your thumbnail…',
  'Analyzing CTR potential…',
  'Analyzing readability…',
  'Analyzing emotion…',
  'Generating recommendations…',
  'Generating your roast report…',
];

@Injectable({
  providedIn: 'root',
})
export class Analysis {
  private readonly upload = inject(Upload);
  private readonly gemini = inject(Gemini);
  private readonly supabase = inject(Supabase);
  private readonly dashboard = inject(Dashboard);

  // ── State signal ───────────────────────────────────────────────────────
  private readonly _state = signal<AnalysisState>({ ...INITIAL_STATE });

  // ── Public derived signals ─────────────────────────────────────────────
  readonly state = this._state.asReadonly();
  readonly step = computed(() => this._state().step);
  readonly progress = computed(() => this._state().progress);
  readonly status = computed(() => this._state().statusMessage);
  readonly previewUrl = computed(() => this._state().previewUrl);
  readonly report = computed(() => this._state().report);
  readonly error = computed(() => this._state().error);
  readonly isWorking = computed(
    () => this._state().step === 'uploading' || this._state().step === 'analyzing',
  );

  // ── Main method: run the full analysis flow ────────────────────────────
  async analyze(file: File): Promise<void> {
    // Set preview immediately so the UI shows the image while processing
    const previewUrl = this.upload.createPreviewUrl(file);
    this.patch({ step: 'uploading', progress: 5, previewUrl, statusMessage: LOADING_MESSAGES[0] });

    try {
      // Step 1: Upload to Supabase Storage
      const userId = this.supabase.currentUser()?.id;
      const imageUrl = await this.upload.uploadThumbnail(file, userId);
      this.patch({ progress: 30, statusMessage: LOADING_MESSAGES[1] });

      // Step 2: Call Edge Function (Gemini) - multi-step loading messages
      this.patch({ step: 'analyzing', progress: 40, statusMessage: LOADING_MESSAGES[2] });

      // Small delay for UX — the analysis is fast, a brief pause feels more "thoughtful"
      await this.delay(300);
      this.patch({ progress: 55, statusMessage: LOADING_MESSAGES[3] });

      const report = await this.gemini.analyze(imageUrl);

      await this.delay(200);
      this.patch({ progress: 85, statusMessage: LOADING_MESSAGES[4] });

      // Step 3: Done
      await this.delay(200);
      this.patch({
        step: 'complete',
        progress: 100,
        statusMessage: LOADING_MESSAGES[5],
        report,
      });

      if (userId) {
        await this.supabase.refreshProfile();
      }

      await this.dashboard.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';

      // Revoke preview URL on error to free memory
      if (this._state().previewUrl) {
        this.upload.revokePreviewUrl(this._state().previewUrl!);
      }

      this.patch({ step: 'error', progress: 0, error: message });
    }
  }

  /** Sets a preview URL (e.g. when user selects a file before submitting) */
  setPreview(file: File): void {
    const url = this.upload.createPreviewUrl(file);
    this.patch({ previewUrl: url });
  }

  /** Full reset back to idle */
  reset(): void {
    if (this._state().previewUrl) {
      this.upload.revokePreviewUrl(this._state().previewUrl!);
    }
    this.upload.reset();
    this._state.set({ ...INITIAL_STATE });
  }

  // ── Private helpers ────────────────────────────────────────────────────
  private patch(partial: Partial<AnalysisState>): void {
    this._state.update((s) => ({ ...s, ...partial }));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
