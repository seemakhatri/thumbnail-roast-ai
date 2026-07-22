import { Component, inject, input, signal, OnInit } from '@angular/core';
import { ReportView } from '../../../../shared/components/report-view/report-view';
import { Supabase } from '../../../../core/services/supabase';
import { Analysis } from '../../../../core/services/analysis';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-results-page',
  imports: [ReportView, RouterLink, CommonModule],
  templateUrl: './results-page.html',
  styleUrl: './results-page.scss',
})
export class ResultsPage implements OnInit {
  readonly id = input<string>();

  private readonly supabase = inject(Supabase);
  private readonly analysis = inject(Analysis);

  readonly report = signal<ThumbnailReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.loadReport();
  }

  async retry(): Promise<void> {
    await this.loadReport();
  }

  private async loadReport(): Promise<void> {
    const reportId = this.id();
    if (!reportId) {
      this.loading.set(false);
      this.error.set('Report not found.');
      return;
    }

    // ── Check if analysis service already has the report ──
    const cachedReport = this.analysis.report();
    if (cachedReport && cachedReport.id === reportId) {
      this.report.set(cachedReport);
      this.loading.set(false);
      // Mark transition as complete
      this.analysis.markTransitionComplete();
      return;
    }

    // ── Fallback: fetch from Supabase ──
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await this.supabase.getReportById(reportId);
      if (!data) {
        this.error.set('Report not found. It may have been deleted.');
        return;
      }
      this.report.set(data);
    } catch {
      this.error.set('Failed to load report. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}