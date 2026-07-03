import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  LucideAngularModule,
  LucideIconData
} from 'lucide-angular';

@Component({
  selector: 'app-upload-section',
  standalone: true,
  imports: [UploadDropzone, LoadingState, LucideAngularModule],
  templateUrl: './upload-section.html',
  styleUrl: './upload-section.scss',
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

 // Lucide icons
  readonly icons = {
    flame: Flame,
    refreshCw: RefreshCw,
    zap: Zap,
    lock: Lock,
    gift: Gift
  };

  readonly proofStats = [
    { icon: this.icons.zap, label: 'Results in <strong>~15 seconds</strong>' },
    { icon: this.icons.lock, label: 'No account needed' },
    { icon: this.icons.gift, label: '<strong>3 free</strong> roasts / month' },
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
    await this.analysis.analyze(file);

    if (this.analysis.error()) {
      this.toast.error(this.analysis.error()!);
      return;
    }

    const report = this.analysis.report();
    if (report) {
      this.toast.success('Analysis complete!');
      await this.router.navigate(['/results', report.id]);
    }
  }

  reset(): void {
    this.selectedFile.set(null);
    this.validationError.set(null);
    this.analysis.reset();
  }
}
