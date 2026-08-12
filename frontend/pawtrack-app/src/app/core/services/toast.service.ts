import { Injectable, signal } from '@angular/core';

export interface ToastData {
  id: number;
  mensaje: string;
  tipo: 'error' | 'exito' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private contador = 0;
  readonly toasts = signal<ToastData[]>([]);

  mostrar(mensaje: string, tipo: 'error' | 'exito' | 'info' = 'info'): void {
    const id = this.contador++;
    this.toasts.update((lista) => [...lista, { id, mensaje, tipo }]);

    setTimeout(() => this.cerrar(id), 3500);
  }

  cerrar(id: number): void {
    this.toasts.update((lista) => lista.filter((t) => t.id !== id));
  }
}