import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';

import { ReportService, RescateResponse } from '../../../../core/services/report.service';
import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { environment } from 'src/environments/environment';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

type EstadoRescate = 'Aceptado' | 'En camino' | 'En sitio' | 'Rescatado' | 'Cancelado';
type FiltroEstado  = EstadoRescate | 'Todos';

interface ItemProtocolo {
  titulo: string;
  descripcion: string;
  completado: boolean;
}

interface CasoAceptado {
  rescateId: number;
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
  color: string;
  raza: string;
  agresividad: string;
  score: number;
  contactoNombre: string;
  contactoTelefono: string;
  estadoRescate: EstadoRescate;
  estadoBackend: string;
  raw: RescateResponse;
}

// Orden de prioridad para el caso enfocado en el aside.
// Los terminados nunca se enfocan, pero los dejamos al final por completitud.
const ORDEN_PRIORIDAD_FOCO: Record<EstadoRescate, number> = {
  'En sitio':  0,
  'En camino': 1,
  Aceptado:    2,
  Rescatado:   3,
  Cancelado:   4,
};

// Los filtros que se pintan en la barra, en orden.
const FILTROS: FiltroEstado[] = ['Todos', 'Aceptado', 'En camino', 'En sitio', 'Rescatado', 'Cancelado'];

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
  ubicacionUsuario = 'Zona Metropolitana, CDMX'; // TODO: traer de geolocalización o perfil del usuario

  filtros = FILTROS;
  filtroEstado: FiltroEstado = 'Todos';

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
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarCasos();
  }

  ionViewWillEnter(): void {
    this.cargarCasos();
  }

  cargarCasos(): void {
    this.cargando = true;
    this.errorCarga = null;
    this.casos = [];
    this.paginaActualCasos = 1;

    if (!this.haySesion()) {
      // Para aceptar un caso hay que estar logueado, así que un invitado
      // nunca tiene casos aceptados.
      this.cargando = false;
      return;
    }

    this.reportService.listarMisRescates().subscribe({
      next: (resp) => {
        this.casos = resp.results.map(r => this.mapearCaso(r));
        this.cargando = false;
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar tus misiones.';
        this.cargando = false;
      },
    });
  }

  haySesion(): boolean {
    return !!localStorage.getItem('pawtrack_access');
  }

  // ─────────────────────────────────────────
  // Mapeo de RescateResponse → CasoAceptado
  // ─────────────────────────────────────────

  private mapearCaso(r: RescateResponse): CasoAceptado {
    const i = r.incidencia;
    const score = i.urgency_score ?? 0;

    return {
      rescateId:       r.rescate_id,
      id:              i.id,
      folio:           i.folio ?? `RPT-${i.id}`,
      titulo:          i.nombre_caso?.trim() || `${i.tipo_animal ?? 'Animal'} en incidencia`,
      descripcion:     (i['notas_animal'] as string)?.trim() || 'Sin descripción.',
      ubicacion:       (i['direccion'] as string)?.trim()
                         || (i.lat_out != null && i.lng_out != null
                               ? `${i.lat_out.toFixed(5)}, ${i.lng_out.toFixed(5)}`
                               : 'Ubicación no disponible'),
      tiempo:          this.tiempoRelativo(r.fecha_aceptacion),
      prioridad:       score >= 80 ? 'Urgente' : score >= 40 ? 'Alta' : 'Moderada',
      fotoUrl:         this.imagenUrl(i.imagen),
      especie:         i.tipo_animal ?? 'Desconocido',
      tamano:          (i['tamano_animal'] as string) ?? 'No especificado',
      condicion:       (i['condicion_animal'] as string) ?? 'No especificada',
      color:           (i['color_animal'] as string) ?? '',
      raza:            (i['raza_animal'] as string) ?? '',
      agresividad:     (i['agresividad_animal'] as string) ?? '',
      score,
      contactoNombre:  i.nombre_contacto ?? 'Anónimo',
      contactoTelefono: i.telefono_contacto ?? 'No disponible',
      estadoRescate:   this.inferirEstadoRescate(r.estado),
      estadoBackend:   r.estado,
      raw:             r,
    };
  }

  // ─────────────────────────────────────────
  // Clasificación de estados
  // ─────────────────────────────────────────

  // Un caso terminado (rescatado o cancelado) ya no se puede trabajar:
  // solo se consulta su expediente.
  esTerminado(caso: CasoAceptado): boolean {
    return caso.estadoRescate === 'Rescatado' || caso.estadoRescate === 'Cancelado';
  }
  /** Chip de advertencia segun como reacciono el animal. */
  chipAgresividad(caso: CasoAceptado): { texto: string; icono: string; clase: string } | null {
    switch (caso.agresividad) {
      case 'agresivo':
        return { texto: 'Agresivo', icono: 'warning',
                clase: 'bg-red-50 text-red-700 border-red-300' };
      case 'asustadizo':
        return { texto: 'Asustadizo', icono: 'directions_run',
                clase: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'docil':
        return { texto: 'Docil', icono: 'volunteer_activism',
                clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'no_evaluable':
        return { texto: 'Sin evaluar', icono: 'help',
                clase: 'bg-slate-100 text-slate-600 border-slate-200' };
      default:
        return null;
    }
  }

  get casosActivos(): CasoAceptado[] {
    return this.casos.filter(c => !this.esTerminado(c));
  }

  get totalActivos(): number    { return this.casosActivos.length; }
  get totalCompletados(): number { return this.casos.filter(c => c.estadoRescate === 'Rescatado').length; }
  get totalCancelados(): number  { return this.casos.filter(c => c.estadoRescate === 'Cancelado').length; }

  get casosUrgentes(): number {
    return this.casosActivos.filter(c => c.prioridad === 'Urgente').length;
  }

  // Cuántos casos hay por filtro (para el contadorcito de cada botón)
  conteoFiltro(filtro: FiltroEstado): number {
    if (filtro === 'Todos') return this.totalActivos;
    return this.casos.filter(c => c.estadoRescate === filtro).length;
  }

  seleccionarFiltro(filtro: FiltroEstado): void {
    this.filtroEstado = filtro;
    this.paginaActualCasos = 1;
  }

  // ─────────────────────────────────────────
  // Caso enfocado para el aside (solo activos)
  // ─────────────────────────────────────────

  get casoEnfocado(): CasoAceptado | undefined {
    const activos = this.casosActivos;
    if (activos.length === 0) return undefined;
    return [...activos].sort(
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
      case 'Cancelado':
        return { titulo: 'Caso liberado', descripcion: 'Cancelaste esta misión. El caso volvió a estar disponible para otro voluntario.' };
    }
  }

  // ─────────────────────────────────────────
  // Filtrado y paginación
  // ─────────────────────────────────────────

  // "Todos" muestra solo las misiones activas. Las resueltas y las canceladas
  // viven en su propio filtro para no ensuciar el trabajo en curso.
  get casosPorVista(): CasoAceptado[] {
    if (this.filtroEstado === 'Todos') return this.casosActivos;
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
  // Estado vacío contextual
  // ─────────────────────────────────────────

  get vacioTitulo(): string {
    switch (this.filtroEstado) {
      case 'Rescatado': return 'Aún no tienes misiones resueltas';
      case 'Cancelado': return 'No has cancelado ninguna misión';
      case 'Todos':     return 'Sin misiones activas';
      default:          return `Ninguna misión en "${this.filtroEstado}"`;
    }
  }

  get vacioTexto(): string {
    switch (this.filtroEstado) {
      case 'Rescatado': return 'Cuando cierres un rescate con evidencia, aparecerá aquí.';
      case 'Cancelado': return 'Los casos que liberes quedarán registrados en este filtro.';
      case 'Todos':     return 'Cuando aceptes una misión, aparecerá aquí con su seguimiento.';
      default:          return 'Prueba con otro filtro para ver tus demás misiones.';
    }
  }

  // Solo ofrecemos "ver casos disponibles" cuando de verdad no hay trabajo.
  get vacioMuestraCta(): boolean {
    return this.filtroEstado === 'Todos';
  }

  // ─────────────────────────────────────────
  // Navegación
  // ─────────────────────────────────────────

  verProgreso(caso: CasoAceptado): void {
    this.router.navigate(['/progress-case', caso.folio]);
  }

  actualizarCaso(caso: CasoAceptado): void {
    this.router.navigate(['/update-case', caso.folio]);
  }

  verDetalles(caso: CasoAceptado): void {
    this.router.navigate(['/details-case-accepted', caso.folio]);
  }

  // Para casos ya terminados: la cronología completa del expediente.
  verExpediente(caso: CasoAceptado): void {
    this.router.navigate(['/cronology-case', caso.folio]);
  }

  // ─────────────────────────────────────────
  // Utilidades
  // ─────────────────────────────────────────

  imagenUrl(imagen: string | null): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }

  // Ícono del badge según el estado del rescate
  iconoEstado(estado: EstadoRescate): string {
    switch (estado) {
      case 'En camino': return 'directions_car';
      case 'En sitio':  return 'location_on';
      case 'Rescatado': return 'check_circle';
      case 'Cancelado': return 'cancel';
      default:          return 'assignment_turned_in';
    }
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

  private inferirEstadoRescate(estado: string): EstadoRescate {
    switch (estado) {
      case 'EN_CAMINO':  return 'En camino';
      case 'EN_SITIO':   return 'En sitio';
      case 'COMPLETADO': return 'Rescatado';
      case 'CANCELADO':  return 'Cancelado';
      default:           return 'Aceptado';
    }
  }
}