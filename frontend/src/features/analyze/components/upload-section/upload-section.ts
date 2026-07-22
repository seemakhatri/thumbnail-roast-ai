import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { UploadDropzone } from '../../../../shared/components/upload-dropzone/upload-dropzone';
import { Analysis } from '../../../../core/services/analysis';
import { Toast } from '../../../../core/services/toast';
import { LoadingState } from '../loading-state/loading-state';
import {
  Flame,
  RefreshCw,
  Zap,
  Lock,
  Gift,
  CheckCircle,
  ArrowRight,
  LucideAngularModule,
} from 'lucide-angular';

@Component({
  selector: 'app-upload-section',
  standalone: true,
  imports: [UploadDropzone, LoadingState, LucideAngularModule],
  templateUrl: './upload-section.html',
  styleUrl: './upload-section.scss',
  animations: [
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('400ms 100ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class UploadSection {
  private readonly analysis = inject(Analysis);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  readonly selectedFile = signal<File | null>(null);
  readonly validationError = signal<string | null>(null);

  readonly step = this.analysis.step;
  readonly progress = this.analysis.progress;
  readonly status = this.analysis.status;
  readonly previewUrl = this.analysis.previewUrl;
  readonly error = this.analysis.error;
  readonly isWorking = this.analysis.isWorking;
  readonly isComplete = this.analysis.isComplete;
  readonly report = this.analysis.report;

  readonly icons = {
    flame: Flame,
    refreshCw: RefreshCw,
    zap: Zap,
    lock: Lock,
    gift: Gift,
    checkCircle: CheckCircle,
    arrowRight: ArrowRight,
  };

  readonly proofStats = [
    { icon: this.icons.zap, label: '<strong>~15 seconds</strong> to decision' },
    { icon: this.icons.lock, label: '<strong>No account</strong> needed' },
    { icon: this.icons.gift, label: '<strong>3 free</strong> analyses / month' },
  ];

  onFileSelected(file: File): void {
    this.validationError.set(null);
    this.selectedFile.set(file);
    this.analysis.setPreview(file);
  }

  onValidationError(message: string): void {
    this.validationError.set(message);
    this.toast.error(message);
  }

  async startAnalysis(): Promise<void> {
    const file = this.selectedFile();
    if (!file) {
      this.toast.error('Please select a thumbnail first.');
      return;
    }

    this.validationError.set(null);

    try {
      const report = await this.analysis.analyze(file);
      // Analysis complete – show the complete state
      // User clicks "View Your Report" to navigate
    } catch (err) {
      this.toast.error(this.analysis.error()!);
    }
  }

  goToResults(): void {
    const report = this.report();
    if (!report) return;

    // Navigate to results page
    this.router.navigate(['/results', report.id]).then(() => {
      // Mark transition as complete after navigation
      this.analysis.markTransitionComplete();
    });
  }

  reset(): void {
    this.selectedFile.set(null);
    this.validationError.set(null);
    this.analysis.reset();
  }
}