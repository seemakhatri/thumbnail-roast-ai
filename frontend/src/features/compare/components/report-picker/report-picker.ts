import {
  Component, computed, inject, input, output, OnInit, signal
} from '@angular/core';
import { Supabase } from '../../../../core/services/supabase';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-report-picker',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './report-picker.html',
  styleUrl: './report-picker.scss',
})
export class ReportPicker implements OnInit {
  // ── Inputs ─────────────────────────────────────────────────────────────
  readonly label   = input<string>('Select Thumbnail');
  readonly exclude = input<string[]>([]); // IDs already picked in other slots

  // ── Output ─────────────────────────────────────────────────────────────
  readonly selected = output<ThumbnailReport | null>();

  private readonly supabase = inject(Supabase);

  readonly reports  = signal<ThumbnailReport[]>([]);
  readonly loading  = signal(true);
  readonly error    = signal<string | null>(null);
  readonly picked   = signal<ThumbnailReport | null>(null);
  readonly open     = signal(false);

  // Filter out reports already selected in other slots
  readonly available = computed(() =>
    this.reports().filter(r => !this.exclude().includes(r.id))
  );

  async ngOnInit() {
    await this.loadReports();
  }

  private async loadReports(): Promise<void> {
    const userId = this.supabase.currentUser()?.id;
    if (!userId) { this.loading.set(false); return; }

    try {
      const data = await this.supabase.getUserReports(userId);
      this.reports.set(data);
    } catch {
      this.error.set('Failed to load thumbnails');
    } finally {
      this.loading.set(false);
    }
  }

  pick(report: ThumbnailReport): void {
    this.picked.set(report);
    this.open.set(false);
    this.selected.emit(report);
  }

  clear(): void {
    this.picked.set(null);
    this.selected.emit(null);
  }

  toggle(): void {
    this.open.update(v => !v);
  }

  scoreColor(score: number): string {
    if (score >= 75) return 'var(--green)';
    if (score >= 50) return 'var(--yellow)';
    return 'var(--red)';
  }
}