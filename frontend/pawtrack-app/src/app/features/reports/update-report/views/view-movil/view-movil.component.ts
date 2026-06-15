import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NavbarComponent } from '../../../../../shared/ui-layouts/navbar-views/navbar/navbar.component';
import { FooterMovilComponent } from '../../../../../shared/ui-layouts/footer-views/footer-movil/footer-movil.component';

import { HeaderMovilComponent } from '../../../../../shared/ui-layouts/header-views/header-movil/header-movil.component';

@Component({
  selector: 'app-view-movil',
  standalone: true,
  imports: [CommonModule, FormsModule, FooterMovilComponent, NavbarComponent, HeaderMovilComponent],
  templateUrl: './view-movil.component.html',
  styleUrls: ['./view-movil.component.scss']
})
export class ViewMovilComponent {
  @Input() reporte!: any;

  @Output() actualizarReporte = new EventEmitter<any>();

  enviar() {
    this.actualizarReporte.emit(this.reporte);
  }

  calcularUrgencia(): number {
    const { herido, deshidratado, asustado } = this.reporte.condiciones;
    let urgencia = 0;
    if (herido) urgencia += 50;
    if (deshidratado) urgencia += 35;
    if (asustado) urgencia += 15;
    return urgencia;
  }

  obtenerTextoUrgencia(): string {
    const urgencia = this.calcularUrgencia();
    if (urgencia == 100) return 'CRÍTICA';
    if (urgencia >= 75) return 'ALTA';
    if (urgencia >= 35) return 'MEDIA';
    return 'BAJA';
  }

  obtenerColorUrgencia(): string {
  const urgencia = this.calcularUrgencia();

  if (urgencia == 100) return 'text-red-950';
  if (urgencia >= 75) return 'text-error';
  if (urgencia >= 35) return 'text-amber-600';
  return 'text-green-600';
}

  obtenerBarraUrgencia(): number {
    const urgencia = this.calcularUrgencia();
    return Math.min(100, Math.max(0, urgencia));
  }
}
