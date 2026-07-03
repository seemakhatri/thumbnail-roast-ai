import { Component, computed, output, signal, OnDestroy } from '@angular/core';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

@Component({
  selector: 'app-upload-dropzone',
  imports: [],
  templateUrl: './upload-dropzone.html',
  styleUrl: './upload-dropzone.scss',
})
export class UploadDropzone implements OnDestroy {
  readonly fileSelected = output<File>();
  readonly validationError = output<string>();

  readonly isDragging = signal(false);
  readonly selectedFile = signal<File | null>(null);

  // Object URL for the preview image — revoked on replace/destroy
  private _objectUrl: string | null = null;
  readonly previewObjectUrl = signal<string | null>(null);

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    input.value = '';
  }

  openFilePicker(input: HTMLInputElement): void {
    input.click();
  }

  replaceFile(input: HTMLInputElement): void {
    this.clearSelection();
    input.click();
  }

  clearSelection(): void {
    this.revokeObjectUrl();
    this.selectedFile.set(null);
  }

  private handleFile(file: File): void {
    const error = this.validate(file);
    if (error) {
      this.validationError.emit(error);
      return;
    }

    this.revokeObjectUrl();
    const url = URL.createObjectURL(file);
    this._objectUrl = url;
    this.previewObjectUrl.set(url);

    this.selectedFile.set(file);
    this.fileSelected.emit(file);
  }

  private revokeObjectUrl(): void {
    if (this._objectUrl) {
      URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = null;
      this.previewObjectUrl.set(null);
    }
  }

  private validate(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please upload a JPG, PNG, or WEBP image.';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File is too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    }
    return null;
  }
}
