import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { formatReportDate, getVerdictDisplay } from '../../../../core/utils/report.utils';

@Component({
  selector: 'app-report-history',
  imports: [RouterLink],
  templateUrl: './report-history.html',
  styleUrl: './report-history.scss',
})
export class ReportHistory {
  readonly reports = input<ThumbnailReport[]>([]);

  formatDate = formatReportDate;
  verdictDisplay = getVerdictDisplay;
}
