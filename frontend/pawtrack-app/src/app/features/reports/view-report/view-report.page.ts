import { Component, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, IncidenciaResponse } from '../../../core/services/report.service';

declare const L: any;

@Component({
  selector: 'app-view-report',
  standalone: true,
  imports: [CommonModule, NavbarWebComponent, RouterLink, IonContent, FooterWebComponent],
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
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.reportService.obtenerReporte(id).subscribe({
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
    if (this.mapaWeb) {
      this.mapaWeb.off();
      this.mapaWeb.remove();
      this.mapaWeb = null;
    }
  }

  private initMapa(): void {
    if (this.reporte?.lat_out == null || this.reporte?.lng_out == null) return;
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.mapaWeb);

    L.circleMarker([this.reporte.lat_out, this.reporte.lng_out], {
      radius: 10,
      fillColor: '#ba1a1a',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(this.mapaWeb);

    setTimeout(() => this.mapaWeb?.invalidateSize(), 150);
  }

  imagenUrl(imagen: string | null): string {
    if (!imagen) return '';
    if (imagen.startsWith('http')) return imagen;
    return `http://localhost:8000${imagen}`;
  }

  tiempoTranscurrido(fecha: string): string {
    const diff = Date.now() - new Date(fecha).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'hace menos de 1 hora';
    if (h < 24) return `hace ${h} hora${h > 1 ? 's' : ''}`;
    const d = Math.floor(h / 24);
    return `hace ${d} día${d > 1 ? 's' : ''}`;
  }

  urgencyLabel(score: number): string {
    if (score >= 80) return 'Urgente';
    if (score >= 40) return 'Moderado';
    return 'Bajo';
  }

  urgencyClass(score: number): string {
    if (score >= 80) return 'bg-error-container text-on-error-container border-error/20';
    if (score >= 40) return 'bg-tertiary-container text-on-tertiary-container border-tertiary/20';
    return 'bg-secondary-container text-on-secondary-container border-secondary/20';
  }

  puedeEditar(): boolean {
    if (!this.reporte || this.reporte.usuario_reporta == null) return false;
    const token = localStorage.getItem('pawtrack_access');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id === this.reporte.usuario_reporta;
    } catch { return false; }
  }

  regresar(): void {
    this.location.back();
  }
}
