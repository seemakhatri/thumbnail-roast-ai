import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'thumbnail-roast-theme';
  private readonly prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  readonly isDark = signal<boolean>(this.loadInitial());

  constructor() {
    effect(() => {
      const dark = this.isDark();
      document.body.classList.toggle('dark-theme', dark);
      localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
    });
  }

  private loadInitial(): boolean {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored !== null) {
      return stored === 'dark';
    }
    return this.prefersDark.matches;
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }

  setDark(dark: boolean): void {
    this.isDark.set(dark);
  }
}