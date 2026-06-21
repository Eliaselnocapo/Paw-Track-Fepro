import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse } from '../../../core/services/report.service';
import { LocalReportCacheService } from '../../../core/services/local-report-cache.service';

import { environment } from 'src/environments/environment';


interface ReporterReport {
  id: number;
  folio: string;
  title: string;
  status: string;
  address: string;
  contactName: string;
  contactPhone: string;
  reportedAt: string;
  updatedAt: string | null;
  animalType: string;
  imageUrl: string;
  urgencyScore: number;
  eta?: string;

  tamanoAnimal: string;
  condicionAnimal: string;
  notasAnimal: string;

  raw: IncidenciaResponse;
}

@Component({
  selector: 'app-view-web',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    RouterLink,
    NavbarWebComponent,
    FooterWebComponent
  ],
  templateUrl: './reporter.page.html',
  styleUrls: ['./reporter.page.scss'],
})
export class ReporterPage implements OnInit {
  reports: ReporterReport[] = [];

  cargando = true;
  errorCarga: string | null = null;
  totalCount = 0;

  modoActual: 'cuenta' | 'invitado' = 'invitado';

  constructor(
    private reportService: ReportService,
    private localReportCache: LocalReportCacheService
  ) {}

  ngOnInit(): void {
    this.cargarReportes();
  }

  ionViewWillEnter(): void {
    this.cargarReportes();
  }

cargarReportes(): void {
  this.cargando = true;
  this.errorCarga = null;
  this.reports = [];
  this.totalCount = 0;

  if (this.haySesion()) {
    this.cargarMisReportesDeCuenta();
    return;
  }

  this.cargarReportesInvitado();
}
  haySesion(): boolean {
    return !!localStorage.getItem('pawtrack_access');
  }

private cargarMisReportesDeCuenta(): void {
  this.reportService.listarMisCasos().subscribe({
    next: (resp) => {
      console.log('MIS REPORTES DE CUENTA:', resp);

      this.reports = resp.map((incidencia) => this.mapearReporte(incidencia));
      this.totalCount = this.reports.length;
      this.cargando = false;
    },
    error: (err) => {
      console.error('ERROR CARGANDO MIS REPORTES:', err);

      this.errorCarga = 'No se pudieron cargar tus reportes de cuenta.';
      this.cargando = false;
    }
  });
}

  private cargarReportesInvitado(): void {
    const folios = this.localReportCache.obtenerFolios();

    console.log('FOLIOS DE INVITADO:', folios);

    if (folios.length === 0) {
      this.reports = [];
      this.totalCount = 0;
      this.cargando = false;
      return;
    }

    const requests = folios.map((folio) =>
      this.reportService.obtenerReportePorFolio(folio).pipe(
        catchError((err) => {
          console.warn('NO SE PUDO CARGAR ESTE FOLIO:', folio, err);
          return of(null);
        })
      )
    );

    forkJoin(requests).subscribe({
      next: (resp) => {
        const reportesValidos = resp.filter(
          (item): item is IncidenciaResponse => item !== null
        );

        console.log('REPORTES DE INVITADO:', reportesValidos);

        this.reports = reportesValidos.map((incidencia) => this.mapearReporte(incidencia));
        this.totalCount = this.reports.length;
        this.cargando = false;
      },
      error: (err) => {
        console.error('ERROR CARGANDO REPORTES DE INVITADO:', err);

        this.errorCarga = 'No se pudieron cargar los reportes guardados en este navegador.';
        this.cargando = false;
      }
    });
  }

  private mapearReporte(incidencia: IncidenciaResponse): ReporterReport {
    return {
      id: incidencia.id,
      folio: incidencia.folio ?? String(incidencia.id),
      title: this.obtenerTituloReporte(incidencia),
      status: incidencia.estado || 'PENDIENTE',
      address: this.obtenerDireccionReporte(incidencia),
      contactName: incidencia.nombre_contacto || 'Contacto no registrado',
      contactPhone: incidencia.telefono_contacto || 'Teléfono no registrado',
      reportedAt: this.obtenerTiempoRelativo(incidencia.created_at, 'Reportado'),
      updatedAt: this.obtenerTiempoActualizado(incidencia.created_at, incidencia.updated_at),
      animalType: incidencia.tipo_animal || 'otro',
      imageUrl: this.imagenUrl(incidencia.imagen),
      urgencyScore: incidencia.urgency_score || 0,
      eta: undefined,

      tamanoAnimal: incidencia.tamano_animal || 'No especificado',
      condicionAnimal: incidencia.condicion_animal || 'No especificada',
      notasAnimal: incidencia.notas_animal || '',

      raw: incidencia
    };
  }

  private obtenerTituloReporte(incidencia: IncidenciaResponse): string {
    if (incidencia.nombre_caso && incidencia.nombre_caso.trim()) {
      return incidencia.nombre_caso;
    }

    const animal = incidencia.tipo_animal || 'Animal';
    const condicion = this.primerCondicion(incidencia.condicion_animal);

    return `${animal} ${condicion}`.trim();
  }

  private obtenerDireccionReporte(incidencia: IncidenciaResponse): string {
    if (incidencia.lat_out != null && incidencia.lng_out != null) {
      return `Ubicación registrada: ${incidencia.lat_out.toFixed(5)}, ${incidencia.lng_out.toFixed(5)}`;
    }

    return 'Ubicación no disponible';
  }

  private obtenerTiempoRelativo(fecha: string | null | undefined, prefijo: string): string {
    if (!fecha) return `${prefijo} no disponible`;

    const fechaReporte = new Date(fecha);
    const ahora = new Date();

    const diferenciaMs = ahora.getTime() - fechaReporte.getTime();
    const minutos = Math.floor(diferenciaMs / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (minutos < 1) return `${prefijo} ahora`;
    if (minutos < 60) return `${prefijo} hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;
    if (horas < 24) return `${prefijo} hace ${horas} hora${horas === 1 ? '' : 's'}`;

    return `${prefijo} hace ${dias} día${dias === 1 ? '' : 's'}`;
  }

  private obtenerTiempoActualizado(
      createdAt: string | null | undefined,
      updatedAt: string | null | undefined
    ): string | null {
      if (!createdAt || !updatedAt) {
        return null;
      }

      const creado = new Date(createdAt).getTime();
      const actualizado = new Date(updatedAt).getTime();

      const diferenciaMs = actualizado - creado;

      if (diferenciaMs < 60000) {
        return null;
      }

      return this.obtenerTiempoRelativo(updatedAt, 'Actualizado');
    }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      EN_REVISION: 'En revisión',
      EN_PROCESO: 'En proceso',
      VALIDANDO: 'Validando',
      ASIGNADO: 'Asignado',
      EN_CAMINO: 'Rescatista en camino',
      CERRADO: 'Cerrado',
      COMPLETADO: 'Completado'
    };

    return labels[status] || 'Pendiente';
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      PENDIENTE: 'bg-slate-100 text-slate-600 border-slate-200',
      EN_REVISION: 'bg-amber-100 text-amber-700 border-amber-200',
      VALIDANDO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      EN_PROCESO: 'bg-blue-100 text-blue-700 border-blue-200',
      ASIGNADO: 'bg-blue-100 text-blue-700 border-blue-200',
      EN_CAMINO: 'bg-blue-100 text-blue-700 border-blue-200',
      CERRADO: 'bg-slate-100 text-slate-600 border-slate-200',
      COMPLETADO: 'bg-slate-100 text-slate-600 border-slate-200'
    };

    return classes[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  }

  getAnimalIcon(animalType: string | null): string {
    switch (animalType?.toLowerCase()) {
      case 'gato':
        return 'pets';

      case 'perro':
        return 'pets';

      case 'ave':
      case 'pajaro':
      case 'pájaro':
        return 'flutter_dash';

      default:
        return 'cruelty_free';
    }
  }

  primerCondicion(val: string | null): string {
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

  urgencyLabel(score: number): string {
    if (score >= 80) return 'Urgente';
    if (score >= 40) return 'Moderado';

    return 'Bajo';
  }

  urgencyClass(score: number): string {
    if (score >= 80) return 'bg-red-100 text-red-700 border-red-200';
    if (score >= 40) return 'bg-amber-100 text-amber-700 border-amber-200';

    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
}