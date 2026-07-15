import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { AuthService } from '../../../core/services/auth.service';

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
  tamano: string;
  condicion: string;
  contactoNombre: string;
  contactoTelefono: string;
  score: number;
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
    RouterLink,
    IonContent,
    TitleCasePipe,
    NavbarWebComponent,
    FooterWebComponent
  ],
  templateUrl: './volunteer.page.html',
  styleUrls: ['./volunteer.page.scss']
})
export class VolunteerPage implements OnInit {
  searchTerm: string = '';
  filtroActivo: string = 'Todos';
  vistaCasos: 'disponibles' | 'urgentes' | 'aceptados' = 'disponibles';

  casosPorPagina = 5;
  paginaActualCasos = 1;

  casos: CasoVoluntario[] = [];
  cargando = true;
  errorCarga: string | null = null;

  constructor(
  private reportService: ReportService,
  private auth: AuthService,
  private router: Router
) {}

  ngOnInit(): void {
    this.cargarCasos();
  }

cargarCasos(): void {
  this.cargando = true;
  this.errorCarga = null;

  this.reportService.listarReportes().subscribe({
    next: (resp: any) => {
      console.log('CASOS PARA VOLUNTARIO:', resp);

      const incidencias: IncidenciaResponse[] = Array.isArray(resp)
      
        ? resp
        : Array.isArray(resp.results)
          ? resp.results
          : Array.isArray(resp.data)
            ? resp.data
            : Array.isArray(resp.incidencias)
              ? resp.incidencias
              : [];

      this.casos = incidencias
        .filter((incidencia) => this.esCasoVisibleParaVoluntario(incidencia))
        .map((incidencia) => this.mapearCaso(incidencia));

      this.cargando = false;
    },
    error: (err) => {
      console.error('ERROR CARGANDO CASOS:', err);
      this.errorCarga = 'No se pudieron cargar los casos disponibles.';
      this.casos = [];
      this.cargando = false;
    }
  });
}

  private esCasoVisibleParaVoluntario(incidencia: IncidenciaResponse): boolean {
    const estado = incidencia.estado || 'PENDIENTE';

    return estado === 'PENDIENTE';
  }

  private mapearCaso(incidencia: IncidenciaResponse): CasoVoluntario {
    return {
      id: incidencia.id,
      folio: incidencia.folio || `RPT-${incidencia.id}`,
      titulo: this.obtenerTituloCaso(incidencia),
      descripcion: this.obtenerDescripcionCaso(incidencia),
      ubicacion: this.obtenerUbicacionCaso(incidencia),
      tiempo: this.obtenerTiempoReporte(incidencia.created_at),
      tamano: incidencia.tamano_animal || 'No especificado',
      condicion: incidencia.condicion_animal || 'No especificada',
      contactoNombre: incidencia.nombre_contacto || 'Contacto no registrado',
      contactoTelefono: incidencia.telefono_contacto || 'Teléfono no registrado',
      score: Math.round(incidencia.urgency_score || 0),
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
    const notas = incidencia.notas_animal?.trim();

    if (!notas) {
      return 'Sin notas adicionales.';
    }

    const limite = 110;

    return notas.length > limite
      ? `${notas.slice(0, limite).trim()}...`
      : notas;
  }

  private obtenerUbicacionCaso(incidencia: IncidenciaResponse): string {
      if (incidencia.direccion?.trim()) {
        return incidencia.direccion.trim();
      }

      if (incidencia.lat_out != null && incidencia.lng_out != null) {
        return `${incidencia.lat_out.toFixed(5)}, ${incidencia.lng_out.toFixed(5)}`;
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
        c.tamano.toLowerCase().includes(term) ||
        c.condicion.toLowerCase().includes(term) ||
        c.contactoNombre.toLowerCase().includes(term) ||
        c.contactoTelefono.toLowerCase().includes(term) ||
        c.folio.toLowerCase().includes(term)
      );
    }

    return filtrados;
  }
  get casosPorVista(): CasoVoluntario[] {
    return this.casosFiltrados;
  }

  get totalPaginasCasos(): number {
    return Math.ceil(this.casosPorVista.length / this.casosPorPagina);
  }

  get casosPaginados(): CasoVoluntario[] {
    const inicio = (this.paginaActualCasos - 1) * this.casosPorPagina;
    const fin = inicio + this.casosPorPagina;

    return this.casosPorVista.slice(inicio, fin);
  }

  get inicioPaginaCasos(): number {
    if (this.casosPorVista.length === 0) return 0;

    return (this.paginaActualCasos - 1) * this.casosPorPagina + 1;
  }

  get finPaginaCasos(): number {
    const fin = this.paginaActualCasos * this.casosPorPagina;

    return Math.min(fin, this.casosPorVista.length);
  }

  get paginasCasos(): number[] {
    return Array.from(
      { length: this.totalPaginasCasos },
      (_, index) => index + 1
    );
  }

  cambiarPaginaCasos(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasCasos) return;

    this.paginaActualCasos = pagina;
  }

  get alertasCercanas(): CasoVoluntario[] {
  return this.casos
    .filter(caso => caso.prioridad === 'Urgente' || caso.prioridad === 'Alta')
    .slice(0, 2);
  }

  setFiltro(filtro: string): void {
    this.filtroActivo = filtro;
  }

  aceptarMision(caso: CasoVoluntario): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], {
        queryParams: {
          returnUrl: this.router.url
        }
      });
      return;
    }
    this.router.navigate(['/accept-case', caso.folio]);
  }
  verDetalles(caso: CasoVoluntario): void {
  this.router.navigate(['/details-case', caso.folio]);
  }

}