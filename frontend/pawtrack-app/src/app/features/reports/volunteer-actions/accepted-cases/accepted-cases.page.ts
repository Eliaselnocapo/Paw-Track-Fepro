import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';
import { LocalReportCacheService } from '../../../../core/services/local-report-cache.service';
import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { environment } from 'src/environments/environment';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

type EstadoRescate = 'Aceptado' | 'En camino' | 'En sitio' | 'Rescatado';

interface ItemProtocolo {
  titulo: string;
  descripcion: string;
  completado: boolean;
}

interface CasoAceptado {
  id: number;
  folio: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  tiempo: string;
  prioridad: string;
  fotoUrl: string;
  especie: string;
  tamano: string;
  condicion: string;
  score: number;
  contactoNombre: string;
  contactoTelefono: string;
  estadoRescate: EstadoRescate;
  estadoBackend: string;
  raw: IncidenciaResponse;
}

// ─────────────────────────────────────────
// Orden de prioridad para el caso enfocado
// en el aside (En sitio > En camino > Aceptado)
// ─────────────────────────────────────────
const ORDEN_PRIORIDAD_FOCO: Record<EstadoRescate, number> = {
  'En sitio':  0,
  'En camino': 1,
  Aceptado:    2,
  Rescatado:   3,
};

@Component({
  selector: 'app-accepted-cases',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
  ],
  templateUrl: './accepted-cases.page.html',
  styleUrls: ['./accepted-cases.page.scss'],
})
export class AcceptedCasesPage implements OnInit {

  casos: CasoAceptado[] = [];
  cargando = true;
  errorCarga: string | null = null;

  filtroEstado: EstadoRescate | 'Todos' = 'Todos';
  paginaActualCasos = 1;
  casosPorPagina = 5;

  protocolo: ItemProtocolo[] = [
    {
      titulo: 'Verificar equipo de contención',
      descripcion: 'Transportadora, correa de seguridad y guantes listos en la unidad.',
      completado: false,
    },
    {
      titulo: 'Evaluación visual inicial',
      descripcion: 'Mantener distancia de 5 m antes de acercarse al animal.',
      completado: false,
    },
    {
      titulo: 'Registro fotográfico previo',
      descripcion: 'Subir evidencia del estado del animal antes del traslado.',
      completado: false,
    },
  ];

  constructor(
    private reportService: ReportService,
    private localReportCache: LocalReportCacheService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarCasos();
  }

  ionViewWillEnter(): void {
    this.cargarCasos();
  }

  // ─────────────────────────────────────────
  // Carga de datos — mismo patrón que reporter.page.ts:
  // sesión real usa listarMisCasos(), invitado usa
  // los folios guardados en caché local.
  // Filtramos solo los que el backend marcó como ASIGNADO
  // (es decir, ya los tomó un voluntario).
  // ─────────────────────────────────────────

  cargarCasos(): void {
    this.cargando = true;
    this.errorCarga = null;
    this.casos = [];
    this.paginaActualCasos = 1;

    if (this.haySesion()) {
      this.cargarDesdeCuenta();
      return;
    }

    this.cargarDesdeCache();
  }

  haySesion(): boolean {
    return !!localStorage.getItem('pawtrack_access');
  }

  private cargarDesdeCuenta(): void {
    this.reportService.listarMisCasos().subscribe({
      next: (resp) => {
        this.casos = resp
          .filter(i => i.estado === 'ASIGNADO')
          .map(i => this.mapearCaso(i));
        this.cargando = false;
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar tus casos aceptados.';
        this.cargando = false;
      },
    });
  }

  private cargarDesdeCache(): void {
    const folios = this.localReportCache.obtenerFolios();

    if (folios.length === 0) {
      this.cargando = false;
      return;
    }

    const peticiones = folios.map(folio =>
      this.reportService.obtenerReportePorFolio(folio).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin(peticiones).subscribe({
      next: (resp) => {
        this.casos = (resp.filter((i): i is IncidenciaResponse => i !== null))
          .filter(i => i.estado === 'ASIGNADO')
          .map(i => this.mapearCaso(i));
        this.cargando = false;
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar los casos guardados en este navegador.';
        this.cargando = false;
      },
    });
  }

  // ─────────────────────────────────────────
  // Mapeo de IncidenciaResponse → CasoAceptado
  // ─────────────────────────────────────────

  private mapearCaso(i: IncidenciaResponse): CasoAceptado {
    const score = i.urgency_score ?? 0;

    return {
      id:              i.id,
      folio:           i.folio ?? `RPT-${i.id}`,
      titulo:          i.nombre_caso?.trim() || `${i.tipo_animal ?? 'Animal'} en incidencia`,
      descripcion:     i.notas_animal?.trim() || 'Sin descripción.',
      ubicacion:       i.lat_out != null && i.lng_out != null
                         ? `Ubicación registrada: ${i.lat_out.toFixed(5)}, ${i.lng_out.toFixed(5)}`
                         : 'Ubicación no disponible',
      tiempo:          this.tiempoRelativo(i.created_at),
      prioridad:       score >= 80 ? 'Urgente' : score >= 40 ? 'Alta' : 'Moderada',
      fotoUrl:         this.imagenUrl(i.imagen),
      especie:         i.tipo_animal ?? 'Desconocido',
      tamano:          i.tamano_animal ?? 'No especificado',
      condicion:       i.condicion_animal ?? 'No especificada',
      score,
      contactoNombre:  i.nombre_contacto ?? 'Anónimo',
      contactoTelefono: i.telefono_contacto ?? 'No disponible',
      estadoRescate:   this.inferirEstadoRescate(i.estado),
      estadoBackend:   i.estado,
      raw:             i,
    };
  }

  // ─────────────────────────────────────────
  // Caso enfocado para el aside
  // ─────────────────────────────────────────

  get casoEnfocado(): CasoAceptado | undefined {
    if (this.casos.length === 0) return undefined;
    return [...this.casos].sort(
      (a, b) => ORDEN_PRIORIDAD_FOCO[a.estadoRescate] - ORDEN_PRIORIDAD_FOCO[b.estadoRescate]
    )[0];
  }

  proximaAccion(caso: CasoAceptado): { titulo: string; descripcion: string } {
    switch (caso.estadoRescate) {
      case 'Aceptado':
        return { titulo: 'Salir a campo', descripcion: 'Confirma que vas en camino al punto de ubicación del animal.' };
      case 'En camino':
        return { titulo: 'Registrar llegada', descripcion: 'Marca cuando llegues al sitio para iniciar la evaluación visual.' };
      case 'En sitio':
        return { titulo: 'Confirmar traslado', descripcion: 'El animal está estable y listo para ser trasladado al refugio asignado.' };
      case 'Rescatado':
        return { titulo: 'Caso cerrado', descripcion: 'Esta misión ya fue completada exitosamente.' };
    }
  }

  // ─────────────────────────────────────────
  // Métricas del header
  // ─────────────────────────────────────────

  get casosCompletadosHoy(): number {
    return 0;
  }

  get casosUrgentes(): number {
    return this.casos.filter(c => c.prioridad === 'Urgente').length;
  }

  get tiempoEnCampo(): string {
    return '—';
  }

  get protocoloCompletado(): number {
    return this.protocolo.filter(p => p.completado).length;
  }

  // ─────────────────────────────────────────
  // Filtrado y paginación
  // ─────────────────────────────────────────

  get casosPorVista(): CasoAceptado[] {
    if (this.filtroEstado === 'Todos') return this.casos;
    return this.casos.filter(c => c.estadoRescate === this.filtroEstado);
  }

  get casosPaginados(): CasoAceptado[] {
    const inicio = (this.paginaActualCasos - 1) * this.casosPorPagina;
    return this.casosPorVista.slice(inicio, inicio + this.casosPorPagina);
  }

  get totalPaginasCasos(): number {
    return Math.ceil(this.casosPorVista.length / this.casosPorPagina) || 1;
  }

  get paginasCasos(): number[] {
    return Array.from({ length: this.totalPaginasCasos }, (_, i) => i + 1);
  }

  get inicioPaginaCasos(): number {
    return this.casosPorVista.length === 0 ? 0 : (this.paginaActualCasos - 1) * this.casosPorPagina + 1;
  }

  get finPaginaCasos(): number {
    return Math.min(this.paginaActualCasos * this.casosPorPagina, this.casosPorVista.length);
  }

  cambiarPaginaCasos(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginasCasos) this.paginaActualCasos = pagina;
  }

  // ─────────────────────────────────────────
  // Navegación
  // ─────────────────────────────────────────

  verDetalle(caso: CasoAceptado): void {
    this.router.navigate(['/details-case-accepted', caso.folio]);
  }

  actualizarCaso(caso: CasoAceptado): void {
    this.router.navigate(['/update-case', caso.folio]);
  }

  verCronologia(caso: CasoAceptado): void {
    this.router.navigate(['/cronology-case', caso.folio]);
  }

  // ─────────────────────────────────────────
  // Utilidades (espejadas de reporter.page.ts)
  // ─────────────────────────────────────────

  imagenUrl(imagen: string | null): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      ASIGNADO:   'Asignado',
      EN_CAMINO:  'Rescatista en camino',
      EN_SITIO:   'En sitio',
      RESCATADO:  'Rescatado',
      COMPLETADO: 'Completado',
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      ASIGNADO:   'bg-slate-100 text-slate-600 border-slate-200',
      EN_CAMINO:  'bg-amber-100 text-amber-700 border-amber-200',
      EN_SITIO:   'bg-blue-100 text-blue-700 border-blue-200',
      RESCATADO:  'bg-emerald-100 text-emerald-700 border-emerald-200',
      COMPLETADO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
    return classes[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  }

  private tiempoRelativo(fecha: string | null | undefined): string {
    if (!fecha) return 'Fecha no disponible';
    const diff = Date.now() - new Date(fecha).getTime();
    const min  = Math.floor(diff / 60000);
    const hrs  = Math.floor(min / 60);
    const dias = Math.floor(hrs / 24);
    if (min < 1)  return 'Hace unos segundos';
    if (min < 60) return `Hace ${min} min`;
    if (hrs < 24) return `Hace ${hrs} h`;
    return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
  }

  private inferirEstadoRescate(estadoBackend: string): EstadoRescate {
    switch (estadoBackend) {
      case 'EN_CAMINO':  return 'En camino';
      case 'EN_SITIO':   return 'En sitio';
      case 'RESCATADO':  return 'Rescatado';
      default:           return 'Aceptado';
    }
  }
}