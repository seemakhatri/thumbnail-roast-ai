import { computed, inject, Injectable, signal } from '@angular/core';
import { ThumbnailReport } from '../models/report.model';
import { Upload } from './upload';
import { Gemini } from './gemini';
import { Supabase } from './supabase';
import { Dashboard } from './dashboard';

export type AnalysisStep = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'transitioning' | 'error';

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

const COMPLETE_MESSAGES = [
  '✅ Analysis complete!',
  '🎯 Ready to see your results',
  '🔥 Your roast is ready',
];

@Injectable({
  providedIn: 'root',
})
export class Analysis {
  private readonly upload = inject(Upload);
  private readonly gemini = inject(Gemini);
  private readonly supabase = inject(Supabase);
  private readonly dashboard = inject(Dashboard);

  private readonly _state = signal<AnalysisState>({ ...INITIAL_STATE });

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
  readonly isComplete = computed(() => this._state().step === 'complete');
  readonly isTransitioning = computed(() => this._state().step === 'transitioning');

  async analyze(file: File): Promise<ThumbnailReport> {
    const previewUrl = this.upload.createPreviewUrl(file);
    this.patch({ step: 'uploading', progress: 5, previewUrl, statusMessage: LOADING_MESSAGES[0] });

    try {
      const userId = this.supabase.currentUser()?.id;
      const imageUrl = await this.upload.uploadThumbnail(file, userId);
      this.patch({ progress: 30, statusMessage: LOADING_MESSAGES[1] });

      this.patch({ step: 'analyzing', progress: 40, statusMessage: LOADING_MESSAGES[2] });
      await this.delay(300);
      this.patch({ progress: 55, statusMessage: LOADING_MESSAGES[3] });

      const report = await this.gemini.analyze(imageUrl);

      await this.delay(200);
      this.patch({ progress: 85, statusMessage: LOADING_MESSAGES[4] });

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

      return report;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      if (this._state().previewUrl) {
        this.upload.revokePreviewUrl(this._state().previewUrl!);
      }
      this.patch({ step: 'error', progress: 0, error: message });
      throw err;
    }
  }

  /** Called after navigation to results page – marks transition as done */
  markTransitionComplete(): void {
    if (this._state().step === 'complete' || this._state().step === 'transitioning') {
      // Keep report data but reset step to idle after a small delay
      setTimeout(() => {
        this.patch({ step: 'idle', progress: 0, statusMessage: '' });
      }, 300);
    }
  }

  setPreview(file: File): void {
    const url = this.upload.createPreviewUrl(file);
    this.patch({ previewUrl: url });
  }

  reset(): void {
    if (this._state().previewUrl) {
      this.upload.revokePreviewUrl(this._state().previewUrl!);
    }
    this.upload.reset();
    this._state.set({ ...INITIAL_STATE });
  }

  private patch(partial: Partial<AnalysisState>): void {
    this._state.update((s) => ({ ...s, ...partial }));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}