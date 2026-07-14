import { Component, inject, input, OnInit, signal } from '@angular/core';
import { ReportView } from '../../../../shared/components/report-view/report-view';
import { Supabase } from '../../../../core/services/supabase';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-results-page',
  imports: [ReportView, RouterLink],
  templateUrl: './results-page.html',
  styleUrl: './results-page.scss',
})
export class ResultsPage implements OnInit {
  readonly id = input<string>();

  private readonly supabase = inject(Supabase);

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
