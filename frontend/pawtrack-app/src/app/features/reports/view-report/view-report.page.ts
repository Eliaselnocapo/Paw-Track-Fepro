import { Component, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, IncidenciaResponse } from '../../../core/services/report.service';
import { LocalReportCacheService } from '../../../core/services/local-report-cache.service';
import { environment } from '../../../../environments/environment';

declare const L: any;

@Component({
  selector: 'app-view-report',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent
  ],
  templateUrl: './view-report.page.html',
  styleUrls: ['./view-report.page.scss'],
})
export class ViewReportComponent implements OnInit, AfterViewInit, OnDestroy {
  reporte: IncidenciaResponse | null = null;

  cargando = true;
  error: string | null = null;

  private mapaWeb: any = null;

  constructor(
    private location: Location,
    private route: ActivatedRoute,
    private reportService: ReportService,
    private localReportCache: LocalReportCacheService,
  ) {}

  ngOnInit(): void {
    const folio = this.route.snapshot.paramMap.get('folio') ?? '';

    if (!folio.trim()) {
      this.error = 'Folio de reporte inválido.';
      this.cargando = false;
      return;
    }

    this.reportService.obtenerReportePorFolio(folio).subscribe({
      next: (data) => {
        this.reporte = data;
        this.cargando = false;

        setTimeout(() => this.initMapa(), 300);
      },
      error: () => {
        this.error = 'No se pudo cargar el reporte.';
        this.cargando = false;
      },
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destruirMapa();
  }

  private initMapa(): void {
    if (!this.reporte) return;
    if (this.reporte.lat_out == null || this.reporte.lng_out == null) return;

    const contenedor = document.getElementById('mapa-reporte-web');

    if (!contenedor || this.mapaWeb) return;

    this.mapaWeb = L.map('mapa-reporte-web', {
      center: [this.reporte.lat_out, this.reporte.lng_out],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.mapaWeb);

    L.circleMarker([this.reporte.lat_out, this.reporte.lng_out], {
      radius: 10,
      fillColor: '#dc2626',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(this.mapaWeb);

    setTimeout(() => this.mapaWeb?.invalidateSize(), 150);
  }

  private destruirMapa(): void {
    if (!this.mapaWeb) return;

    this.mapaWeb.off();
    this.mapaWeb.remove();
    this.mapaWeb = null;
  }

  imagenUrl(imagen: string | null): string {
    if (!imagen) return '';

    if (imagen.startsWith('http')) {
      return imagen;
    }

    return `${environment.apiUrl}${imagen}`;
  }

  tiempoTranscurrido(fecha: string): string {
    if (!fecha) return 'recientemente';

    const fechaReporte = new Date(fecha).getTime();

    if (Number.isNaN(fechaReporte)) {
      return 'recientemente';
    }

    const diferencia = Date.now() - fechaReporte;

    const minutos = Math.floor(diferencia / 60000);
    const horas = Math.floor(diferencia / 3600000);
    const dias = Math.floor(horas / 24);

    if (minutos < 1) {
      return 'hace unos segundos';
    }

    if (minutos < 60) {
      return `hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
    }

    if (horas < 24) {
      return `hace ${horas} hora${horas > 1 ? 's' : ''}`;
    }

    return `hace ${dias} día${dias > 1 ? 's' : ''}`;
  }

  urgencyLabel(score: number): string {
    if (score >= 80) return 'Urgente';
    if (score >= 40) return 'Moderado';
    return 'Bajo';
  }

  urgencyClass(score: number): string {
    if (score >= 80) {
      return 'bg-red-50 text-red-700 border-red-100';
    }

    if (score >= 40) {
      return 'bg-amber-50 text-amber-700 border-amber-100';
    }

    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  urgencyTextClass(score: number): string {
    if (score >= 80) return 'text-red-700';
    if (score >= 40) return 'text-amber-700';
    return 'text-emerald-700';
  }

  puedeEditar(): boolean {
    if (!this.reporte) return false;

    // Usuario autenticado: verificar que sea el dueño
    const token = localStorage.getItem('pawtrack_access');
    if (token && this.reporte.usuario_reporta != null) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user_id === this.reporte.usuario_reporta;
      } catch { return false; }
    }

    // Invitado: verificar que el folio esté en su caché local
    if (!token && this.reporte.usuario_reporta == null && this.reporte.folio) {
      return this.localReportCache.obtenerFolios().includes(this.reporte.folio);
    }

    return false;
  }

  regresar(): void {
    this.location.back();
  }
}