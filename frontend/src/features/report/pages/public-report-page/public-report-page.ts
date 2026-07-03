import { Component, inject, input, OnInit, signal } from '@angular/core';
import { ReportView } from '../../../../shared/components/report-view/report-view';
import { Gemini } from '../../../../core/services/gemini';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-report-page',
  imports: [ReportView, RouterLink],
  templateUrl: './public-report-page.html',
  styleUrl: './public-report-page.scss',
})
export class PublicReportPage implements OnInit {
  readonly slug = input<string>();

  private readonly gemini = inject(Gemini);

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
    const slug = this.slug();
    if (!slug) {
      this.loading.set(false);
      this.error.set('Invalid report link.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await this.gemini.getReportBySlug(slug);
      this.report.set(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load report.';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
