import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Supabase } from './supabase';
import { environment } from '../../../environments/environment';

export interface UploadProgress {
  stage: 'idle' | 'validating' | 'uploading' | 'done' | 'error';
  percent: number;
  error: string | null;
}
 
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

@Injectable({
  providedIn: 'root',
})
export class Upload {
private readonly supabaseService = inject(Supabase);
private readonly platformId = inject(PLATFORM_ID);
  readonly progress = signal<UploadProgress>({
    stage: 'idle',
    percent: 0,
    error: null,
  });
 
  /** Validates and uploads a thumbnail file. Returns the public URL. */
  async uploadThumbnail(file: File, userId?: string): Promise<string> {
const supabase = this.supabaseService.client;
    // ── Validate ──────────────────────────────────────────────────────
    this.progress.set({ stage: 'validating', percent: 5, error: null });
 
    if (!ALLOWED_TYPES.includes(file.type)) {
      const err = 'Please upload a JPG, PNG, or WEBP image.';
      this.progress.set({ stage: 'error', percent: 0, error: err });
      throw new Error(err);
    }
 
    if (file.size > MAX_SIZE_BYTES) {
      const err = `File is too large. Maximum size is ${MAX_SIZE_MB}MB.`;
      this.progress.set({ stage: 'error', percent: 0, error: err });
      throw new Error(err);
    }
 
    // ── Build storage path ────────────────────────────────────────────
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const folder = userId ?? 'guest';
    const filename = `${folder}/${crypto.randomUUID()}.${ext}`;
 
    // ── Upload ────────────────────────────────────────────────────────
    this.progress.set({ stage: 'uploading', percent: 20, error: null });
 
    const { data, error } = await supabase.storage
      .from('thumbnails')
      .upload(filename, file, {
        contentType: file.type,
        upsert: false,
        // Note: Supabase JS client doesn't support upload progress events yet.
        // We simulate progress with the stages above.
      });
 
    if (error) {
      const err = `Upload failed: ${error.message}`;
      this.progress.set({ stage: 'error', percent: 0, error: err });
      throw new Error(err);
    }
 
    // ── Get public URL ────────────────────────────────────────────────
    const { data: urlData } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(data.path);
 
    this.progress.set({ stage: 'done', percent: 100, error: null });
 
    return urlData.publicUrl;
  }
 
  /** Creates a local object URL for preview (no upload needed) */
  createPreviewUrl(file: File): string {
    if (!isPlatformBrowser(this.platformId)) {
      return '';
    }
    return URL.createObjectURL(file);
  }
 
  /** Revokes an object URL to free memory */
  revokePreviewUrl(url: string): void {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
 
  reset(): void {
    this.progress.set({ stage: 'idle', percent: 0, error: null });
  }
}
