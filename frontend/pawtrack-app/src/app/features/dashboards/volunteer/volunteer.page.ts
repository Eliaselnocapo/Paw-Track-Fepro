import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse } from '../../../core/services/report.service';

import { environment } from 'src/environments/environment';

interface CasoVoluntario {
  id: number;
  folio: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  tiempo: string;
  prioridad: 'Urgente' | 'Alta' | 'Moderada';
  especie: 'Perro' | 'Gato' | 'Otro';
  fotoUrl: string;
  estado: string;
  raw: IncidenciaResponse;
}

@Component({
  selector: 'app-volunteer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NavbarWebComponent,
    FooterWebComponent,
    IonContent
  ],
  templateUrl: './volunteer.page.html',
  styleUrls: ['./volunteer.page.scss']
})
export class VolunteerPage implements OnInit {
  searchTerm: string = '';
  filtroActivo: string = 'Todos';

  casos: CasoVoluntario[] = [];
  cargando = true;
  errorCarga: string | null = null;

  constructor(private reportService: ReportService) {}

  ngOnInit(): void {
    this.cargarCasos();
  }

  cargarCasos(): void {
    this.cargando = true;
    this.errorCarga = null;

    this.reportService.listarReportes().subscribe({
      next: (resp) => {
        console.log('CASOS PARA VOLUNTARIO:', resp);

        this.casos = resp
          .filter((incidencia) => this.esCasoVisibleParaVoluntario(incidencia))
          .map((incidencia) => this.mapearCaso(incidencia));

        this.cargando = false;
      },
      error: (err) => {
        console.error('ERROR CARGANDO CASOS:', err);
        this.errorCarga = 'No se pudieron cargar los casos disponibles.';
        this.cargando = false;
      }
    });
  }

  private esCasoVisibleParaVoluntario(incidencia: IncidenciaResponse): boolean {
    const estado = incidencia.estado || 'PENDIENTE';

    return estado !== 'CERRADO' && estado !== 'COMPLETADO';
  }

  private mapearCaso(incidencia: IncidenciaResponse): CasoVoluntario {
    return {
      id: incidencia.id,
      folio: incidencia.folio || `RPT-${incidencia.id}`,
      titulo: this.obtenerTituloCaso(incidencia),
      descripcion: this.obtenerDescripcionCaso(incidencia),
      ubicacion: this.obtenerUbicacionCaso(incidencia),
      tiempo: this.obtenerTiempoReporte(incidencia.created_at),
      prioridad: this.obtenerPrioridad(incidencia.urgency_score || 0),
      especie: this.obtenerEspecie(incidencia.tipo_animal),
      fotoUrl: this.imagenUrl(incidencia.imagen),
      estado: incidencia.estado || 'PENDIENTE',
      raw: incidencia
    };
  }

  private obtenerTituloCaso(incidencia: IncidenciaResponse): string {
    if (incidencia.nombre_caso && incidencia.nombre_caso.trim()) {
      return incidencia.nombre_caso;
    }

    const animal = incidencia.tipo_animal || 'Animal';
    const condicion = this.primerCondicion(incidencia.condicion_animal);

    return `${animal} ${condicion}`.trim();
  }

  private obtenerDescripcionCaso(incidencia: IncidenciaResponse): string {
    const partes: string[] = [];

    if (incidencia.tipo_animal) {
      partes.push(`Especie: ${incidencia.tipo_animal}`);
    }

    if (incidencia.tamano_animal) {
      partes.push(`Tamaño: ${incidencia.tamano_animal}`);
    }

    if (incidencia.condicion_animal) {
      partes.push(`Condición: ${incidencia.condicion_animal}`);
    }

    if (incidencia.notas_animal) {
      partes.push(`Notas: ${incidencia.notas_animal}`);
    }

    return partes.length > 0
      ? partes.join(' · ')
      : 'Caso registrado en espera de información adicional.';
  }

  private obtenerUbicacionCaso(incidencia: IncidenciaResponse): string {
    if (incidencia.lat_out != null && incidencia.lng_out != null) {
      return `Ubicación registrada: ${incidencia.lat_out.toFixed(5)}, ${incidencia.lng_out.toFixed(5)}`;
    }

    return 'Ubicación no disponible';
  }

  private obtenerTiempoReporte(fecha: string | null): string {
    if (!fecha) return 'Fecha no disponible';

    const fechaReporte = new Date(fecha);
    const ahora = new Date();

    const diferenciaMs = ahora.getTime() - fechaReporte.getTime();
    const minutos = Math.floor(diferenciaMs / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (minutos < 1) return 'Hace unos segundos';
    if (minutos < 60) return `Hace ${minutos} min`;
    if (horas < 24) return `Hace ${horas} h`;

    return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
  }

  private obtenerPrioridad(score: number): 'Urgente' | 'Alta' | 'Moderada' {
    if (score >= 80) return 'Urgente';
    if (score >= 40) return 'Alta';
    return 'Moderada';
  }

  private obtenerEspecie(tipo: string | null): 'Perro' | 'Gato' | 'Otro' {
    const normalizado = tipo?.toLowerCase();

    if (normalizado === 'perro') return 'Perro';
    if (normalizado === 'gato') return 'Gato';

    return 'Otro';
  }

  private primerCondicion(val: string | null): string {
    if (!val) return 'sin condición especificada';

    return val.split(',')[0]?.trim() || 'sin condición especificada';
  }

  imagenUrl(imagen: string | null): string {
    if (!imagen) {
      return 'assets/images/report-placeholder.jpg';
    }

    if (imagen.startsWith('http')) {
      return imagen;
    }

    return `${environment.apiUrl}${imagen}`;
  }

  get casosFiltrados(): CasoVoluntario[] {
    let filtrados = this.casos;

    if (this.filtroActivo !== 'Todos') {
      filtrados = filtrados.filter(c => c.prioridad === this.filtroActivo);
    }

    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase();

      filtrados = filtrados.filter(c =>
        c.titulo.toLowerCase().includes(term) ||
        c.ubicacion.toLowerCase().includes(term) ||
        c.descripcion.toLowerCase().includes(term) ||
        c.especie.toLowerCase().includes(term) ||
        c.folio.toLowerCase().includes(term)
      );
    }

    return filtrados;
  }

  setFiltro(filtro: string): void {
    this.filtroActivo = filtro;
  }

  aceptarMision(caso: CasoVoluntario): void {
    this.reportService.actualizarReporte(caso.id, {
      estado: 'EN_PROCESO'
    }).subscribe({
      next: () => {
        this.cargarCasos();
      },
      error: (err) => {
        console.error('No se pudo aceptar la misión:', err);
      }
    });
  }
}