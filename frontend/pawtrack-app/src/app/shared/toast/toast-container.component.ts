import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="flex items-center gap-3 px-4 py-3 rounded shadow-lg border animate-in fade-in slide-in-from-top-2"
          [ngClass]="{
            'bg-emerald-50 border-emerald-200 text-emerald-800': toast.tipo === 'exito',
            'bg-red-50 border-red-200 text-red-700': toast.tipo === 'error',
            'bg-blue-50 border-blue-200 text-blue-800': toast.tipo === 'info'
          }">
          <span class="material-symbols-outlined text-[20px] shrink-0">
            {{ toast.tipo === 'exito' ? 'check_circle' : toast.tipo === 'error' ? 'error' : 'info' }}
          </span>
          <p class="text-sm font-semibold flex-1">{{ toast.mensaje }}</p>
          <button
            type="button"
            (click)="toastService.cerrar(toast.id)"
            class="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}