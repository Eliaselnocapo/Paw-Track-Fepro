import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { Location } from '@angular/common';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse, EntradaHistorial } from '../../../../core/services/report.service';
import { environment } from 'src/environments/environment';
import { RevealDirective } from 'src/app/shared/directives/reveal.directive';

type TipoPunto = 'inicio' | 'avance' | 'cierre' | 'cancelacion';

interface PuntoLinea {
  titulo: string;
  descripcion: string;
  timestamp: string;
  nota?: string;
  motivo?: string;
  tipo: TipoPunto;
  lat?: number;
  lng?: number;
  fotoCierre?: string | null;
}

@Component({
  selector: 'app-cronology-case',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, IonContent, NavbarWebComponent, FooterWebComponent, RevealDirective],
  templateUrl: './cronology-case.page.html',
  styleUrls: ['./cronology-case.page.scss'],
})
export class CronologyCasePage implements OnInit {

  private location = inject(Location);
  incidencia: IncidenciaResponse | null = null;
  historial: EntradaHistorial[] = [];
  estadoSeguimiento = '';
  createdAt: string | null = null;

  cargando = true;
  errorCarga: string | null = null;

  fotoCierreApi: string | null = null;

  // Direcciones resueltas con reverse-geocoding: el cierre solo guarda coords,
  // y los reportes viejos tampoco guardaron 'direccion'.
  direccionCierre: string | null = null;
  direccionReporteGeo: string | null = null;
  cargandoDirecciones = false;

  // Qué puntos de la cronología tienen su detalle abierto.
  private detallesAbiertos = new Set<number>();

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

    this.reportService.obtenerReportePorFolio(folio).subscribe({
      next: (inc) => {
        this.incidencia = inc;
        this.resolverDireccionReporte();

        this.reportService.seguimientoPorFolio(folio).subscribe({
          next: (seg: any) => {
            this.estadoSeguimiento = seg?.estado || '';
            this.createdAt = seg?.created_at || inc.created_at || null;
          },
          error: () => { this.createdAt = inc.created_at || null; },
        });

        this.reportService.seguimientoHistorialPorFolio(folio).subscribe({
          next: (resp) => {
            this.historial = resp.historial || [];
            this.fotoCierreApi = (resp as any).foto_cierre || null;
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

  // ── Detalle desplegable de cada punto ─────

  /** Un punto tiene detalle si trae nota, motivo o datos de cierre. */
  tieneDetalle(punto: PuntoLinea): boolean {
    return !!punto.nota || !!punto.motivo || punto.tipo === 'cierre';
  }

  estaAbierto(index: number): boolean {
    return this.detallesAbiertos.has(index);
  }

  toggleDetalle(index: number): void {
    if (this.detallesAbiertos.has(index)) this.detallesAbiertos.delete(index);
    else this.detallesAbiertos.add(index);
  }

  /** Etiqueta del boton segun lo que esconde el punto. */
  etiquetaDetalle(punto: PuntoLinea): string {
    if (punto.motivo) return 'Ver motivo';
    if (punto.tipo === 'cierre') return 'Ver evidencia del cierre';
    return 'Ver nota del voluntario';
  }

  // ── Datos del animal ──────────────────────

  get titulo(): string {
    const i = this.incidencia;
    return i?.nombre_caso?.trim() || `${i?.tipo_animal ?? 'Animal'} en incidencia`;
  }

  get folio(): string { return this.incidencia?.folio || ''; }
  get especie(): string { return this.incidencia?.tipo_animal || 'No especificado'; }
  get tamano(): string { return this.incidencia?.tamano_animal || 'No especificado'; }
  get condicion(): string { return this.incidencia?.condicion_animal || 'No especificada'; }
  get notasReportante(): string { return this.incidencia?.notas_animal?.trim() || 'Sin notas del reportante.'; }
  get score(): number { return Math.round(this.incidencia?.urgency_score ?? 0); }
  get peso(): string { return this.incidencia?.peso_estimado?.trim() || 'No registrado'; }
  get edad(): string { return this.incidencia?.edad_estimada?.trim() || 'No registrada'; }
  get color(): string { return this.incidencia?.color_animal?.trim() || 'No especificado'; }
  get raza(): string  { return this.incidencia?.raza_animal?.trim()  || 'No identificada'; }

  
  get agresividad(): string | null {
    // Columna propia (reportes nuevos)
    const col = this.incidencia?.agresividad_animal?.trim();
    if (col) return col;

    // Reportes viejos: el temperamento vivia concatenado en ficha_voluntario
    const texto = this.incidencia?.ficha_voluntario ?? '';
    const match = texto.match(/Temperamento:\s*([^|]+)/i);
    if (!match) return null;

    const valor = match[1].trim().toLowerCase();
    if (valor.startsWith('doc') || valor.startsWith('dóc')) return 'docil';
    if (valor.startsWith('asu')) return 'asustadizo';
    if (valor.startsWith('agr')) return 'agresivo';
    return 'no_evaluable';
  }

  get etiquetaTemperamento(): string {
    switch (this.agresividad) {
      case 'docil':        return 'Dócil';
      case 'asustadizo':   return 'Asustadizo';
      case 'agresivo':     return 'Agresivo';
      case 'no_evaluable': return 'Sin evaluar';
      default:             return 'Sin registrar';
    }
  }

  get claseTemperamento(): string {
    switch (this.agresividad) {
      case 'agresivo':   return 'border-red-200 bg-red-50 text-red-700';
      case 'asustadizo': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'docil':      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      default:           return 'border-slate-200 bg-slate-50 text-slate-400';
    }
  }
  

  get nivelUrgencia(): string {
    if (this.score >= 80) return 'Urgente';
    if (this.score >= 40) return 'Alta';
    return 'Moderada';
  }

  // ── Personas involucradas ─────────────────

  get reportanteNombre(): string { return this.incidencia?.nombre_contacto?.trim() || 'Anónimo'; }
  get reportanteTelefono(): string { return this.incidencia?.telefono_contacto?.trim() || 'No registrado'; }
  get rescatistaNombre(): string | null { return this.incidencia?.rescatista_info?.nombre?.trim() || null; }
  get rescatistaEmail(): string | null { return this.incidencia?.rescatista_info?.email?.trim() || null; }

  /** Ficha clinica que llenó el voluntario, separada en etiqueta/valor. */
get fichaVoluntario(): { etiqueta: string; valor: string }[] {
    const ficha = this.incidencia?.ficha_voluntario?.trim();
    if (!ficha) return [];

    return ficha.split('|').map(p => p.trim()).filter(Boolean).map(par => {
      const [etiqueta, ...resto] = par.split(':');
      return {
        etiqueta: (etiqueta || '').trim(),
        valor: resto.join(':').trim() || '—',
      };
    })
    // El temperamento ya tiene columna propia: lo quitamos del texto para
    // no duplicarlo (los reportes viejos aun lo traen concatenado).
    .filter(d => !/temperamento/i.test(d.etiqueta));
  }

  // ── Ubicaciones ───────────────────────────

  get direccionReporte(): string {
    const guardada = this.incidencia?.direccion?.trim();
    if (guardada) return guardada;
    if (this.direccionReporteGeo) return this.direccionReporteGeo;

    const i = this.incidencia;
    if (i?.lat_out != null && i?.lng_out != null) {
      return `${i.lat_out.toFixed(5)}, ${i.lng_out.toFixed(5)}`;
    }
    return 'Ubicación no disponible';
  }

  get coordsReporte(): string | null {
    const i = this.incidencia;
    if (i?.lat_out == null || i?.lng_out == null) return null;
    return `${i.lat_out.toFixed(6)}, ${i.lng_out.toFixed(6)}`;
  }

  /** El animal se movio del punto reportado al punto de cierre. */
  get huboTraslado(): boolean {
    const i = this.incidencia;
    const c = this.puntoCierre;
    if (!c || c.lat == null || c.lng == null || i?.lat_out == null || i?.lng_out == null) return false;
    return Math.abs(c.lat - i.lat_out) > 0.0005 || Math.abs(c.lng - i.lng_out) > 0.0005;
  }

  // ── Estado del expediente ─────────────────

  get estaCerrado(): boolean {
    return !!this.puntoCierre
        || this.estadoSeguimiento === 'CERRADO'
        || this.incidencia?.estado === 'CERRADO';
  }

  get estaCancelado(): boolean {
    return !!this.puntoCancelacion && !this.puntoCierre;
  }

  get estadoTexto(): string {
    if (this.estaCerrado)   return 'Caso cerrado';
    if (this.estaCancelado) return 'Rescate cancelado';
    return 'En proceso';
  }

  get duracionRescate(): string | null {
    const fin = this.puntoCierre ?? this.puntoCancelacion;
    if (!this.createdAt || !fin) return null;

    const ms = new Date(fin.timestamp).getTime() - new Date(this.createdAt).getTime();
    if (ms <= 0) return null;

    const min  = Math.floor(ms / 60000);
    const hrs  = Math.floor(min / 60);
    const dias = Math.floor(hrs / 24);

    if (min < 60) return `${min} min`;
    if (hrs < 24) return `${hrs} h`;
    return `${dias} día${dias === 1 ? '' : 's'}`;
  }

  imagenUrl(imagen: string | null | undefined): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    if (imagen.startsWith('http')) return imagen;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${imagen}`;
  }

  // ── Linea de tiempo ───────────────────────

  get lineaTiempo(): PuntoLinea[] {
    const items: PuntoLinea[] = [];

    if (this.createdAt) {
      items.push({
        titulo: 'Reporte creado',
        descripcion: `${this.reportanteNombre} reportó el caso, que quedó en espera de un voluntario.`,
        timestamp: this.createdAt,
        tipo: 'inicio',
      });
    }

    for (const h of this.historial) {
      switch (h.estado) {
        case 'COMPLETADO':
          items.push({
            titulo: 'Rescate completado',
            descripcion: 'El animal fue asegurado y el caso se cerró con evidencia.',
            timestamp: h.timestamp,
            nota: h.nota,
            tipo: 'cierre',
            lat: h.ubicacion_cierre?.lat,
            lng: h.ubicacion_cierre?.lng,
            fotoCierre: h.foto_cierre ?? null,
          });
          break;

        case 'CANCELADO':
          items.push({
            titulo: 'Rescate cancelado',
            descripcion: 'El voluntario liberó el caso y volvió a estar disponible.',
            timestamp: h.timestamp,
            nota: h.nota,
            motivo: h.motivo,
            tipo: 'cancelacion',
          });
          break;

        case 'EN_CAMINO':
          items.push({
            titulo: 'Caso aceptado',
            descripcion: 'Un voluntario tomó la misión y va en camino.',
            timestamp: h.timestamp,
            nota: h.nota,
            tipo: 'avance',
          });
          break;

        case 'EN_SITIO':
          items.push({
            titulo: 'Voluntario en sitio',
            descripcion: 'El voluntario llegó al punto del animal.',
            timestamp: h.timestamp,
            nota: h.nota,
            tipo: 'avance',
          });
          break;

        default:
          items.push({
            titulo: this.estadoLegible(h.estado),
            descripcion: '',
            timestamp: h.timestamp,
            nota: h.nota,
            tipo: 'avance',
          });
      }
    }
    return items;
  }

  get totalAvances(): number { return this.lineaTiempo.length; }

  get puntoCierre(): PuntoLinea | null {
    return this.lineaTiempo.find(p => p.tipo === 'cierre') ?? null;
  }

  get puntoCancelacion(): PuntoLinea | null {
    return this.lineaTiempo.find(p => p.tipo === 'cancelacion') ?? null;
  }

  get fotoEvidencia(): string | null {
    if (this.fotoCierreApi) return this.fotoCierreApi;
    const foto = this.puntoCierre?.fotoCierre;
    return foto ? this.imagenUrl(foto) : null;
  }

  // ── Reverse-geocoding ─────────────────────

  private resolverDireccionCierre(): void {
    const cierre = this.puntoCierre;
    if (!cierre || cierre.lat == null || cierre.lng == null) return;

    this.cargandoDirecciones = true;
    this.reportService.obtenerDireccionCompleta(cierre.lat, cierre.lng)
      .then(dir => { this.direccionCierre = dir; })
      .finally(() => { this.cargandoDirecciones = false; });
  }

  private resolverDireccionReporte(): void {
    const i = this.incidencia;
    if (!i || i.direccion?.trim()) return;
    if (i.lat_out == null || i.lng_out == null) return;

    this.reportService.obtenerDireccionCompleta(i.lat_out, i.lng_out)
      .then(dir => { this.direccionReporteGeo = dir; });
  }

  // ── Utilidades ────────────────────────────

  estadoLegible(estado: string): string {
    switch (estado) {
      case 'EN_CAMINO':  return 'Voluntario en camino';
      case 'EN_SITIO':   return 'Voluntario en sitio';
      case 'COMPLETADO': return 'Rescate completado';
      case 'CANCELADO':  return 'Rescate cancelado';
      default:           return estado;
    }
  }

  iconoPunto(tipo: TipoPunto): string {
    switch (tipo) {
      case 'inicio':      return 'flag';
      case 'cierre':      return 'verified';
      case 'cancelacion': return 'cancel';
      default:            return 'radio_button_checked';
    }
  }

  volver(): void {
    this.location.back();
  }
}