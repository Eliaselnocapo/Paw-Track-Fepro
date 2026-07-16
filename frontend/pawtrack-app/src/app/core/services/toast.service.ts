import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastController = inject(ToastController);

  async mostrar(mensaje: string, tipo: 'error' | 'exito' | 'info' = 'info'): Promise<void> {
    const color = tipo === 'error' ? 'danger' : tipo === 'exito' ? 'success' : 'medium';

    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3500,
      color,
      position: 'top',
      buttons: [{ text: 'Cerrar', role: 'cancel' }],
    });

    await toast.present();
  }
}