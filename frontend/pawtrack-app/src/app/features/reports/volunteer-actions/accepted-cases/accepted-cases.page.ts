import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';

import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';
import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { environment } from 'src/environments/environment';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

type EstadoRescate = 'Aceptado' | 'En camino' | 'En sitio' | 'Rescatado';

interface EntradaBitacora {
  titulo: string;
  descripcion: string;
  hora: string;
  estado: 'completado' | 'activo' | 'pendiente';
}

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
  progresoRescate: number;
  bitacora: EntradaBitacora[];
  raw: IncidenciaResponse;
}

// ─────────────────────────────────────────
// Mapa de progreso por estado
// ─────────────────────────────────────────
const PROGRESO_POR_ESTADO: Record<EstadoRescate, number> = {
  Aceptado:   15,
  'En camino': 40,
  'En sitio':  65,
  Rescatado:  100,
};

@Component({
  selector: 'app-accepted-cases',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    IonContent,
    TitleCasePipe,
    NavbarWebComponent,
    FooterWebComponent,
  ],
  templateUrl: './accepted-cases.page.html',
  styleUrls: ['./accepted-cases.page.scss'],
})
export class AcceptedCasesPage implements OnInit {

  casos: CasoAceptado[] = [];
  alertasCercanas: CasoAceptado[] = [];
  cargando = true;
  errorCarga: string | null = null;

  searchTerm = '';
  filtroActivo = 'Todos';
  paginaActualCasos = 1;
  casosPorPagina = 5;

  // Checklist de protocolo — estado local del turno
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

  // ─────────────────────────────────────────
  // Carga de datos
  // ─────────────────────────────────────────

  cargarCasos(): void {
    this.cargando = true;
    this.errorCarga = null;

    this.reportService.listarReportes().subscribe({
      next: (resp: any) => {
        const incidencias: IncidenciaResponse[] = Array.isArray(resp)
          ? resp
          : resp.results ?? resp.data ?? resp.incidencias ?? [];

        this.casos = incidencias
          .filter(i => i.estado === 'ASIGNADO')
          .map(i => this.mapearCaso(i));

        this.alertasCercanas = incidencias
          .filter(i => i.estado === 'REPORTADO' && (i.urgency_score ?? 0) >= 60)
          .slice(0, 3)
          .map(i => this.mapearCaso(i));

        this.cargando = false;
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar los casos.';
        this.cargando = false;
      },
    });
  }

  // ─────────────────────────────────────────
  // Mapeo de incidencia → CasoAceptado
  // ─────────────────────────────────────────

  private mapearCaso(i: IncidenciaResponse): CasoAceptado {
    const score = i.urgency_score ?? 0;
    const estadoRescate = this.inferirEstadoRescate(i.estado);

    return {
      id:               i.id,
      folio:            i.folio ?? `RPT-${i.id}`,
      titulo:           i.nombre_caso?.trim() || `${i.tipo_animal ?? 'Animal'} en incidencia`,
      descripcion:      i.notas_animal?.trim() || 'Sin descripción.',
      ubicacion:        i.lat_out != null && i.lng_out != null
                          ? `${i.lat_out.toFixed(5)}, ${i.lng_out.toFixed(5)}`
                          : 'Ubicación no disponible',
      tiempo:           this.calcularTiempo(i.created_at),
      prioridad:        score >= 80 ? 'Urgente' : score >= 40 ? 'Alta' : 'Moderada',
      fotoUrl:          this.imagenUrl(i.imagen),
      especie:          i.tipo_animal ?? 'Desconocido',
      tamano:           i.tamano_animal ?? 'No especificado',
      condicion:        i.condicion_animal ?? 'No especificada',
      score,
      contactoNombre:   i.nombre_contacto ?? 'Anónimo',
      contactoTelefono: i.telefono_contacto ?? 'No disponible',
      estadoRescate,
      progresoRescate:  PROGRESO_POR_ESTADO[estadoRescate],
      bitacora:         this.construirBitacora(i, estadoRescate),
      raw:              i,
    };
  }

  // ─────────────────────────────────────────
  // Bitácora — construye los pasos del rescate
  // basándose en el estado actual del backend.
  // Si tu backend devuelve eventos reales, reemplaza
  // esta lógica con el array de eventos directamente.
  // ─────────────────────────────────────────

  private construirBitacora(i: IncidenciaResponse, estado: EstadoRescate): EntradaBitacora[] {
    const created = this.formatearHora(i.created_at);

    const pasos: Array<{ titulo: string; descripcion: string; minEstado: EstadoRescate }> = [
      {
        titulo: 'Caso aceptado',
        descripcion: 'Misión confirmada por el voluntario.',
        minEstado: 'Aceptado',
      },
      {
        titulo: 'Unidad despachada',
        descripcion: 'En ruta hacia la ubicación del reporte.',
        minEstado: 'En camino',
      },
      {
        titulo: 'Llegada al sitio',
        descripcion: 'Voluntario presente en la ubicación.',
        minEstado: 'En sitio',
      },
      {
        titulo: 'Animal rescatado',
        descripcion: 'Traslado a clínica u hogar temporal confirmado.',
        minEstado: 'Rescatado',
      },
    ];

    const orden: EstadoRescate[] = ['Aceptado', 'En camino', 'En sitio', 'Rescatado'];
    const idxActual = orden.indexOf(estado);

    return pasos.map((paso, idx) => {
      const idxPaso = orden.indexOf(paso.minEstado);
      const esActivo    = idxPaso === idxActual;
      const esCompletado = idxPaso < idxActual;

      return {
        titulo:      paso.titulo,
        descripcion: paso.descripcion,
        hora:        idxPaso === 0 ? created : esCompletado || esActivo ? this.horaRelativa(i.created_at, idxPaso * 30) : '',
        estado:      esCompletado ? 'completado' : esActivo ? 'activo' : 'pendiente',
      };
    });
  }

  // ─────────────────────────────────────────
  // Getters de métricas del header
  // ─────────────────────────────────────────

  get casosCompletadosHoy(): number {
    return 0; // Reemplazar con datos reales del backend
  }

  get casosUrgentes(): number {
    return this.casos.filter(c => c.prioridad === 'Urgente').length;
  }

  get tiempoEnCampo(): string {
    return '—'; // Reemplazar con lógica de sesión si la tienes
  }

  get protocoloCompletado(): number {
    return this.protocolo.filter(p => p.completado).length;
  }

  // ─────────────────────────────────────────
  // Filtrado y paginación
  // ─────────────────────────────────────────

  get casosPorVista(): CasoAceptado[] {
    return this.casos.filter(c => {
      const term = this.searchTerm.toLowerCase();
      const matchSearch = !term
        || c.titulo.toLowerCase().includes(term)
        || c.ubicacion.toLowerCase().includes(term)
        || c.especie.toLowerCase().includes(term)
        || c.folio.toLowerCase().includes(term);
      const matchFilter = this.filtroActivo === 'Todos' || c.prioridad === this.filtroActivo;
      return matchSearch && matchFilter;
    });
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
    if (pagina >= 1 && pagina <= this.totalPaginasCasos) {
      this.paginaActualCasos = pagina;
    }
  }

  // ─────────────────────────────────────────
  // Navegación
  // ─────────────────────────────────────────

  verDetalle(caso: CasoAceptado): void {
    this.router.navigate(['/details-case-accepted', caso.folio]);
  }

  actualizarProgreso(caso: CasoAceptado): void {
    this.router.navigate(['/progress-case', caso.folio]);
  }

  verDetalleAlerta(caso: CasoAceptado): void {
    this.router.navigate(['/details-case', caso.folio]);
  }

  // ─────────────────────────────────────────
  // Utilidades privadas
  // ─────────────────────────────────────────

  imagenUrl(imagen: string | null): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }

  private calcularTiempo(fecha: string | null): string {
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

  private formatearHora(fecha: string | null): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  private horaRelativa(fecha: string | null, minutosExtra: number): string {
    if (!fecha) return '—';
    const d = new Date(new Date(fecha).getTime() + minutosExtra * 60000);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  private inferirEstadoRescate(estadoBackend: string): EstadoRescate {
    // Adaptar según los valores reales que devuelva tu backend
    switch (estadoBackend) {
      case 'EN_CAMINO':   return 'En camino';
      case 'EN_SITIO':    return 'En sitio';
      case 'RESCATADO':   return 'Rescatado';
      default:            return 'Aceptado';
    }
  }
}