import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class Toast {
  private nextId = 0;
  readonly messages = signal<ToastMessage[]>([]);

  show(message: string, type: ToastType = 'info', durationMs = 4000): void {
    const id = ++this.nextId;
    this.messages.update(list => [...list, { id, message, type }]);

    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 6000);
  }

  dismiss(id: number): void {
    this.messages.update(list => list.filter(t => t.id !== id));
  }
}
