import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse, EntradaHistorial } from '../../../../core/services/report.service';
import { environment } from '../../../../../environments/environment';
import * as L from 'leaflet';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';

@Component({
  selector: 'app-view-follow-up',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
  ],
  templateUrl: './view-follow-up.page.html',
  styleUrls: ['./view-follow-up.page.scss'],
})
export class ViewFollowUpPage implements OnInit, OnDestroy {

  private mapaFinal: any = null;
  incidencia: IncidenciaResponse | null = null;
  seguimiento: any = null;   // respuesta de seguimientoPorFolio (estado, rescatista, etc.)

  cargando = true;
  errorCarga: string | null = null;

  pasos = ['En camino', 'En sitio', 'Rescatado'];
  pasoExpandido: number | null = null;
  historial: EntradaHistorial[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  // ─────────────────────────────────────────
  // Carga: incidencia (ficha) + seguimiento (estado)
  // ─────────────────────────────────────────

cargar(): void {
  const folio = this.route.snapshot.paramMap.get('folio');

  if (!folio) {
    this.errorCarga = 'No se encontró el folio del caso.';
    this.cargando = false;
    return;
  }

  this.cargando = true;
  this.errorCarga = null;

  this.reportService.obtenerReportePorFolio(folio).subscribe({
    next: (inc) => {
      this.incidencia = inc;

      this.reportService.seguimientoPorFolio(folio).subscribe({
        next: (seg) => { this.seguimiento = seg; this.cargando = false; },
        error: () => { this.cargando = false; },
      });
    },
    error: () => {
      this.errorCarga = 'No se pudo cargar el seguimiento del caso.';
      this.cargando = false;
    },
  });

  // Historial de avances del voluntario (endpoint público)
  this.reportService.seguimientoHistorialPorFolio(folio).subscribe({
    next: (resp) => { this.historial = resp.historial || []; this.initMapaFinal(); },
    error: () => { this.historial = []; },
  });
}
  ngOnDestroy(): void {
    if (this.mapaFinal) {
      this.mapaFinal.remove();
      this.mapaFinal = null;
    }
  }

  // ─────────────────────────────────────────
  // Estado del caso
  // ─────────────────────────────────────────

  get estado(): string {
    return this.incidencia?.estado || 'PENDIENTE';
  }
  get estadoIcono(): string {
    switch (this.estado) {
      case 'CERRADO':      return 'verified';
      case 'ATENDIENDOSE': return 'directions_car';
      default:             return 'hourglass_top';
    }
  }

  get estadoLegible(): string {
    switch (this.estado) {
      case 'PENDIENTE':    return 'Pendiente de ayuda';
      case 'ATENDIENDOSE': return 'En atención';
      case 'CERRADO':      return 'Caso cerrado';
      default:             return this.estado;
    }
  }

  get estadoClase(): string {
    switch (this.estado) {
      case 'ATENDIENDOSE': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'CERRADO':      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:             return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  get tieneRescatista(): boolean {
    return !!this.incidencia?.rescatista_info;
  }

  get rescatistaNombre(): string {
    return this.incidencia?.rescatista_info?.nombre || 'Un voluntario';
  }

  get lineaTiempo(): { estado: string; timestamp: string; nota?: string; esInicio?: boolean; centro?: string }[] {
    const items: { estado: string; timestamp: string; nota?: string; esInicio?: boolean; centro?: string }[] = [];

    const creado = (this.seguimiento as any)?.created_at || (this.incidencia as any)?.created_at;
    if (creado) {
      items.push({ estado: 'Reporte creado', timestamp: creado, esInicio: true });
    }

    for (const h of this.historial) {
      items.push({
        estado: this.estadoLegibleHist(h.estado),
        timestamp: h.timestamp,
        nota: h.nota,
        centro: (h as any).centro,
      });
    }
    return items;
  }

  estadoLegibleHist(estado: string): string {
    switch (estado) {
      case 'EN_CAMINO':   return 'Voluntario en camino';
      case 'EN_SITIO':    return 'Voluntario en sitio';
      case 'EN_PROCESO':  return 'En proceso';
      case 'EN_TRASLADO': return 'En traslado';
      case 'COMPLETADO':  return 'Rescate completado';
      case 'CANCELADO':   return 'Rescate cancelado';
      default:            return estado;
    }
  }


  get estaCerrado(): boolean {
    return this.estado === 'CERRADO';
  }

  // Ubicacion final del rescate (de la entrada COMPLETADO del historial)
  get ubicacionFinal(): { lat: number; lng: number } | null {
    const cierre = this.historial.find(h => h.estado === 'COMPLETADO');
    const ubi = (cierre as any)?.ubicacion_cierre;
    if (ubi && ubi.lat != null && ubi.lng != null) {
      return { lat: ubi.lat, lng: ubi.lng };
    }
    return null;
  }

  verCronologia(): void {
    this.router.navigate(['/cronology-case', this.incidencia?.folio]);
  }
  // ─────────────────────────────────────────
  // Progreso (según estado de la incidencia)
  // ─────────────────────────────────────────
  get pasoActualIndex(): number {
    if (this.estado === 'CERRADO') return 2;
    if (this.estado === 'ATENDIENDOSE') return 1;
    return 0;
  }

  esPasoCompletado(i: number): boolean {
    return i < this.pasoActualIndex || this.estado === 'CERRADO';
  }

  esPasoActivo(i: number): boolean {
    return i === this.pasoActualIndex && this.estado !== 'CERRADO';
  }

  iconoPaso(i: number): string {
    return i === 0 ? 'directions_car' : i === 1 ? 'my_location' : 'verified';
  }

  // ─────────────────────────────────────────
  // Ficha del voluntario (parseada de caracteristicas)
  // ─────────────────────────────────────────

  get evaluacionItems(): { label: string; valor: string }[] {
    const raw: string = this.incidencia?.ficha_voluntario?.trim() || '';
    if (!raw) return [];
    return raw.split('|')
      .map(p => p.trim())
      .filter(p => p && !p.toLowerCase().startsWith('notas clínicas'))
      .map(p => {
        const [label, ...resto] = p.split(':');
        return { label: label.trim(), valor: resto.join(':').trim() };
      })
      .filter(x => x.valor);
  }

  get notasClinicas(): string {
    const raw: string = this.incidencia?.ficha_voluntario || '';
    const parte = raw.split('|').map(p => p.trim()).find(p => p.toLowerCase().startsWith('notas clínicas'));
    return parte ? parte.split(':').slice(1).join(':').trim() : '';
  }

  // ─────────────────────────────────────────
  // Datos de presentación
  // ─────────────────────────────────────────

  get titulo(): string {
    const i = this.incidencia;
    return i?.nombre_caso?.trim() || `${i?.tipo_animal ?? 'Animal'} en incidencia`;
  }
  get color(): string {
    return this.incidencia?.color_animal?.trim() || 'No especificado';
  }

  get raza(): string {
    return this.incidencia?.raza_animal?.trim() || 'No identificada';
  }

  get agresividad(): string | null {
    return this.incidencia?.agresividad_animal?.trim() || null;
  }

  get etiquetaAgresividad(): string {
    switch (this.agresividad) {
      case 'docil':        return 'Se dejó acercar';
      case 'asustadizo':   return 'Se alejó o huyó';
      case 'agresivo':     return 'Gruñó o intentó morder';
      case 'no_evaluable': return 'No pudo acercarse';
      default:             return 'Sin evaluar';
    }
  }

  get claseAgresividad(): string {
    switch (this.agresividad) {
      case 'agresivo':   return 'border-red-200 bg-red-50 text-red-700';
      case 'asustadizo': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'docil':      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      default:           return 'border-slate-200 bg-slate-50 text-slate-500';
    }
  }

  get especie(): string { return this.incidencia?.tipo_animal || 'No especificado'; }
  get tamano(): string { return this.incidencia?.tamano_animal || 'No especificado'; }
  get condicion(): string { return this.incidencia?.condicion_animal || 'No especificada'; }
  get edad(): string { return this.incidencia?.edad_estimada || 'No especificada'; }
  get peso(): string { return this.incidencia?.peso_estimado || 'No especificado'; }

  get notasReportante(): string {
    return this.incidencia?.notas_animal?.trim() || 'Sin notas registradas.';
  }

  imagenUrl(imagen: string | null | undefined): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }

  volver(): void {
    this.router.navigate(['/dashboard/reporter']);
  }

  private initMapaFinal(): void {
    const ubi = this.ubicacionFinal;
    if (this.mapaFinal || !ubi) return;

    setTimeout(() => {
      const el = document.getElementById('mapa-final');
      if (!el || !ubi) return;

      this.mapaFinal = L.map('mapa-final', {
        zoomControl: true,
        attributionControl: false,
      }).setView([ubi.lat, ubi.lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(this.mapaFinal);

      const icono = L.divIcon({
        className: 'pin-final',
        html: '<div class="pin-final-inner"><span class="material-symbols-outlined">pets</span></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      L.marker([ubi.lat, ubi.lng], { icon: icono }).addTo(this.mapaFinal);
    }, 150);
  }
}