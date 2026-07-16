import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import {
  IonIcon,
  IonModal
} from '@ionic/angular/standalone';

import { environment } from 'src/environments/environment';

export interface CasoModal {
  id: number;

  imagen: string | null;

  tipo_animal: string;
  tamano_animal: string;
  condicion_animal: string;

  edad_estimada?: string;
  peso_estimado?: string;

  nombre_caso?: string;
  caracteristicas?: string;
  notas_animal?: string;

  estado: string;
  tipo_incidencia: string;

  recompensa: number | null;
  folio: string;
}

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  standalone: true,
  imports: [
    IonModal,
    IonIcon
  ]
})
export class ModalComponent {

  @Input() isOpen = false;

  @Input() caso: CasoModal | null = null;

  @Output() cerrar =
    new EventEmitter<void>();

  solicitarCierre(): void {
    this.cerrar.emit();
  }

  obtenerTituloCaso(
    caso: CasoModal
  ): string {
    const nombre =
      caso.nombre_caso?.trim();

    if (nombre) {
      return this.formatearTexto(nombre);
    }

    const tipo =
      caso.tipo_animal?.trim() ||
      'Animal';

    return this.formatearTexto(
      `${tipo} reportado`
    );
  }

  obtenerDescripcion(
    caso: CasoModal
  ): string {
    return (
      caso.caracteristicas?.trim() ||
      caso.notas_animal?.trim() ||
      'No se proporcionaron características adicionales.'
    );
  }

  obtenerUrlImagen(
    imagen: string | null
  ): string {
    if (!imagen) {
      return '';
    }

    if (
      imagen.startsWith('http://') ||
      imagen.startsWith('https://') ||
      imagen.startsWith('data:')
    ) {
      return imagen;
    }

    const apiUrl =
      environment.apiUrl.replace(
        /\/$/,
        ''
      );

    const ruta =
      imagen.startsWith('/')
        ? imagen
        : `/${imagen}`;

    return `${apiUrl}${ruta}`;
  }

  formatearTexto(
    valor?: string | null
  ): string {
    if (!valor?.trim()) {
      return 'Sin especificar';
    }

    return valor
      .trim()
      .toLocaleLowerCase('es-MX')
      .replace(
        /(^|[\s,./-])([a-záéíóúñü])/g,
        (
          _coincidencia: string,
          separador: string,
          letra: string
        ) =>
          `${separador}${letra.toLocaleUpperCase('es-MX')}`
      );
  }

  formatearRecompensa(
    cantidad: number
  ): string {
    return new Intl.NumberFormat(
      'es-MX',
      {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 0
      }
    ).format(cantidad);
  }

  claseEstado(
    estado?: string
  ): string {
    const valor =
      estado?.toUpperCase() || '';

    if (valor === 'ATENDIENDOSE') {
      return 'estado-atendiendose';
    }

    if (valor === 'RESUELTO') {
      return 'estado-resuelto';
    }

    return 'estado-pendiente';
  }
}
