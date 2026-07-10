import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse, EntradaHistorial } from '../../../../core/services/report.service';
import { environment } from 'src/environments/environment';

interface PuntoLinea {
  titulo: string;
  timestamp: string;
  nota?: string;
  tipo: 'inicio' | 'avance' | 'cierre';
  lat?: number;
  lng?: number;
}

@Component({
  selector: 'app-cronology-case',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, IonContent, NavbarWebComponent, FooterWebComponent],
  templateUrl: './cronology-case.page.html',
  styleUrls: ['./cronology-case.page.scss'],
})
export class CronologyCasePage implements OnInit {

  incidencia: IncidenciaResponse | null = null;
  historial: EntradaHistorial[] = [];
  estadoSeguimiento = '';
  createdAt: string | null = null;

  cargando = true;
  errorCarga: string | null = null;
  direccionCierre: string | null = null;
  cargandoDireccionCierre = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    const folio = this.route.snapshot.paramMap.get('folio');
    if (!folio) {
      this.errorCarga = 'No se encontró el folio del caso.';
      this.cargando = false;
      return;
    }

    this.cargando = true;
    this.errorCarga = null;

    // Ficha del animal
    this.reportService.obtenerReportePorFolio(folio).subscribe({
      next: (inc) => {
        this.incidencia = inc;

        // Estado + created_at (resumen)
        this.reportService.seguimientoPorFolio(folio).subscribe({
          next: (seg: any) => {
            this.estadoSeguimiento = seg?.estado || '';
            this.createdAt = seg?.created_at || null;
          },
        });

        // Historial detallado
        this.reportService.seguimientoHistorialPorFolio(folio).subscribe({
          next: (resp) => {
            this.historial = resp.historial || [];
            this.cargando = false;
            this.resolverDireccionCierre();
          },
          error: () => { this.historial = []; this.cargando = false; },
        });
      },
      error: () => {
        this.errorCarga = 'No se pudo cargar el expediente del caso.';
        this.cargando = false;
      },
    });
  }

  // ── Presentacion ──────────────────────────

  get titulo(): string {
    const i = this.incidencia;
    return i?.nombre_caso?.trim() || `${i?.tipo_animal ?? 'Animal'} en incidencia`;
  }

  get folio(): string { return this.incidencia?.folio || ''; }
  get especie(): string { return this.incidencia?.tipo_animal || 'No especificado'; }
  get tamano(): string { return this.incidencia?.tamano_animal || 'No especificado'; }
  get condicion(): string { return this.incidencia?.condicion_animal || 'No especificada'; }
  get notasReportante(): string { return this.incidencia?.notas_animal?.trim() || 'Sin notas.'; }

  get estaCerrado(): boolean {
    return this.estadoSeguimiento === 'CERRADO' || (this.incidencia?.estado === 'CERRADO');
  }

  imagenUrl(imagen: string | null | undefined): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }

  // ── Linea de tiempo completa ──────────────

  get lineaTiempo(): PuntoLinea[] {
    const items: PuntoLinea[] = [];

    if (this.createdAt) {
      items.push({ titulo: 'Reporte creado', timestamp: this.createdAt, tipo: 'inicio' });
    }

    for (const h of this.historial) {
      if (h.estado === 'COMPLETADO') {
        const ubi = (h as any).ubicacion_cierre;
        items.push({
          titulo: 'Rescate completado',
          timestamp: h.timestamp,
          nota: h.nota,
          tipo: 'cierre',
          lat: ubi?.lat,
          lng: ubi?.lng,
        });
      } else {
        items.push({
          titulo: this.estadoLegible(h.estado),
          timestamp: h.timestamp,
          nota: h.nota,
          tipo: 'avance',
        });
      }
    }
    return items;
  }

  get puntoCierre(): PuntoLinea | null {
    return this.lineaTiempo.find(p => p.tipo === 'cierre') ?? null;
  }
  /** Geocodifica la ubicación del cierre (que solo guarda coords) una sola vez. */
  private resolverDireccionCierre(): void {
    const cierre = this.puntoCierre;
    if (!cierre || cierre.lat == null || cierre.lng == null) return;

    this.cargandoDireccionCierre = true;
    this.reportService.obtenerDireccionCompleta(cierre.lat, cierre.lng)
      .then(dir => { this.direccionCierre = dir; })
      .finally(() => { this.cargandoDireccionCierre = false; });
  }

  estadoLegible(estado: string): string {
    switch (estado) {
      case 'EN_CAMINO':  return 'Voluntario en camino';
      case 'EN_SITIO':   return 'Voluntario en sitio';
      case 'COMPLETADO': return 'Rescate completado';
      case 'CANCELADO':  return 'Rescate cancelado';
      default:           return estado;
    }
  }

  iconoPunto(tipo: string): string {
    return tipo === 'inicio' ? 'flag' : tipo === 'cierre' ? 'verified' : 'radio_button_checked';
  }

  volver(): void {
    this.router.navigate(['/accepted-cases']);
  }
}