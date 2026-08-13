import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CartelReporte } from '../models/cartel-reporte.model'; // AJUSTA la ruta a tu modelo real

interface MensajeCondicion {
  etiqueta: string;
  titulo: string;
}

type ColorCondicion = 'rojo' | 'ambar' | 'azul';

@Component({
  selector: 'app-cartel-template',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cartel-template.component.html',
})
export class CartelTemplateComponent {
  /** Datos del reporte, mismos que ya usa el CartelPdf actual. */
  @Input() datos!: CartelReporte;

  /** URL o dataURL ya resuelta de la imagen (o null si no hay foto real). */
  @Input() imagenResuelta: string | null = null;

  get mensaje(): MensajeCondicion {
    const valor = this.condicionNormalizada;

    if (valor.includes('herido') || valor.includes('enfermo')) {
      return { etiqueta: 'NECESITA ATENCIÓN', titulo: '¡Ayudémoslo ahora!' };
    }
    if (valor.includes('extraviado')) {
      return { etiqueta: 'ANIMAL EXTRAVIADO', titulo: 'Ayúdalo a regresar a casa' };
    }
    if (valor.includes('callejero')) {
      return { etiqueta: 'BUSCA UNA OPORTUNIDAD', titulo: 'Ayúdanos a darle un hogar' };
    }
    if (valor.includes('abandonado') || valor.includes('maltratado')) {
      return { etiqueta: 'NECESITA PROTECCIÓN', titulo: 'No lo dejemos solo' };
    }
    return { etiqueta: 'ANIMAL REPORTADO', titulo: 'Necesita nuestra ayuda' };
  }

  get colorCondicion(): ColorCondicion {
    const valor = this.condicionNormalizada;
    if (valor.includes('herido') || valor.includes('enfermo')) return 'rojo';
    if (valor.includes('callejero') || valor.includes('extraviado')) return 'ambar';
    return 'azul';
  }

  get nombreCasoFormateado(): string {
    return this.formatoTitulo(
      this.datos.nombreCaso || `${this.datos.tipoAnimal || 'Animal'} reportado`
    );
  }

  get descripcionTexto(): string {
    const partes = [this.datos.caracteristicas, this.datos.notasAnimal]
      .filter((v): v is string => !!v && v.trim() !== '');

    return partes.length
      ? partes.join('. ')
      : 'No se proporcionaron características adicionales.';
  }

  get nombreContactoFormateado(): string {
    return this.formatoTitulo(this.datos.nombreContacto || 'Contacto no especificado');
  }

  private get condicionNormalizada(): string {
    return (this.datos.condicionAnimal || '').trim().toLocaleLowerCase('es-MX');
  }

  formatoTitulo(valor?: string | null): string {
    if (!valor || valor.trim() === '') return 'No especificado';

    return valor
      .trim()
      .toLocaleLowerCase('es-MX')
      .replace(
        /(^|[\s,./-])([a-záéíóúñü])/g,
        (_m: string, sep: string, letra: string) =>
          `${sep}${letra.toLocaleUpperCase('es-MX')}`
      );
  }
}