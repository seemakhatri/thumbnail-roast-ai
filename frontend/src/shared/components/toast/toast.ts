import { Component, inject } from '@angular/core';
import { Toast } from '../../../core/services/toast';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class ToastContainer {
  readonly toast = inject(Toast);

  dismiss(id: number): void {
    this.toast.dismiss(id);
  }
}
