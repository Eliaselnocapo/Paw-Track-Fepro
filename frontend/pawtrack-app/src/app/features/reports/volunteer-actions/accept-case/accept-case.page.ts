import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from 'src/environments/environment';

interface CasoAceptacion {
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
  latitud: number | null;
  longitud: number | null;
  raw: IncidenciaResponse;
}

@Component({
  selector: 'app-accept-case',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    TitleCasePipe,
    NavbarWebComponent,
    FooterWebComponent,
  ],
  templateUrl: './accept-case.page.html',
  styleUrls: ['./accept-case.page.scss'],
})
export class AcceptCasePage implements OnInit {
  caso: CasoAceptacion | null = null;

  cargando = true;
  errorCarga: string | null = null;

  revisoInformacion    = false;
  tieneDisponibilidad  = false;
  aceptaSeguimiento    = false;
  aceptaSeguridad      = false;

  confirmando = false;
  errorConfirmacion: string | null = null;
  errorEsDefinitivo = false;
  modalErrorAbierto = false;
  

  constructor(
    private route:         ActivatedRoute,
    private router:        Router,
    private reportService: ReportService,
    private auth:          AuthService,
  ) {}

  ngOnInit(): void {
    this.cargarCaso();
  }

  // ─────────────────────────────────────────
  // Carga del caso por folio
  // ─────────────────────────────────────────

  cargarCaso(): void {
    const folio = this.route.snapshot.paramMap.get('folio');

    if (!folio) {
      this.errorCarga = 'No se encontró el folio del caso.';
      this.cargando = false;
      return;
    }

    this.cargando = true;
    this.errorCarga = null;

    this.reportService.listarReportes().subscribe({
      next: (resp: any) => {
        const incidencias: IncidenciaResponse[] = Array.isArray(resp)
          ? resp
          : resp.results ?? resp.data ?? resp.incidencias ?? [];

        const incidencia = incidencias.find(
          item => item.folio === folio || `RPT-${item.id}` === folio
        );

        if (!incidencia) {
          this.errorCarga = 'No se encontró el caso solicitado.';
          this.cargando = false;
          return;
        }

        this.caso = this.mapearCaso(incidencia);
        this.cargando = false;
      },
      error: () => {
        this.errorCarga = 'No se pudo cargar la información del caso.';
        this.cargando = false;
      },
    });
  }

  // ─────────────────────────────────────────
  // Confirmación de aceptación
  //
  // Delega toda la lógica de simulación / conexión
  // real a reportService.aceptarCaso().
  // Para cambiar de simulado a real: solo editar
  // el método aceptarCaso() en report.service.ts.
  // ─────────────────────────────────────────

  confirmarAceptacion(): void {
    if (!this.caso || !this.puedeConfirmar || this.confirmando) return;

    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.confirmando = true;
    this.errorConfirmacion = null;

    this.reportService.aceptarCaso(this.caso.folio!).subscribe({
      next: () => {
        this.confirmando = false;
        this.navegarAExito();
      },
      error: (err) => {
        this.confirmando = false;
        this.errorConfirmacion = this.mensajeError(err);
        this.errorEsDefinitivo = [400, 403, 404, 409].includes(err?.status);
        this.modalErrorAbierto = true;
      },
    });
    
  }
  cerrarModalError(): void {
    this.modalErrorAbierto = false;
  }

  private navegarAExito(): void {
    this.router.navigate(['/case-accepted-success'], {
      queryParams: {
        folio:  this.caso?.folio,
        titulo: this.caso?.titulo,
      },
    });
  }
  /**
   * Traduce el error del back a algo que el voluntario entienda.
   * Contrato de AceptarRescateView:
   *   403 → no tiene rol RESCATISTA
   *   404 → folio inexistente
   *   400 → la incidencia ya no está PENDIENTE
   *   409 → otro rescatista la tomó primero (condición de carrera)
   */
  private mensajeError(err: any): string {
    switch (err?.status) {
      case 401:
        return 'Tu sesión expiró. Vuelve a iniciar sesión para aceptar el caso.';
      case 403:
        return 'Tu cuenta no tiene el rol de rescatista, así que no puede tomar misiones. Actívalo desde tu perfil.';
      case 404:
        return 'Este caso ya no existe. Es posible que el reportante lo haya eliminado.';
      case 400:
        return 'Este caso ya no está disponible: alguien más lo está atendiendo.';
      case 409:
        return 'Otro voluntario tomó este caso antes que tú. Busca otro en la lista de casos disponibles.';
      case 0:
        return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
      default:
        return err?.error?.detail || 'No se pudo aceptar el caso. Intenta de nuevo.';
    }
  }

  cancelar(): void {
    this.router.navigate(
      this.caso ? ['/details-case', this.caso.folio] : ['/volunteer']
    );
  }

  volverCasos(): void {
    this.router.navigate(['/dashboard/volunteer']);
  }

  // ─────────────────────────────────────────
  // Mapeo IncidenciaResponse → CasoAceptacion
  // ─────────────────────────────────────────

  private mapearCaso(i: IncidenciaResponse): CasoAceptacion {
    return {
      id:               i.id,
      folio:            i.folio || `RPT-${i.id}`,
      titulo:           this.obtenerTitulo(i),
      descripcion:      i.notas_animal?.trim() || 'Sin notas adicionales registradas por el reportante.',
      ubicacion:        i.direccion?.trim()
                                || (i.lat_out != null && i.lng_out != null
                                      ? `${i.lat_out.toFixed(5)}, ${i.lng_out.toFixed(5)}`
                                      : 'Ubicación no disponible'),
      tiempo:           this.tiempoRelativo(i.created_at),
      tamano:           i.tamano_animal    || 'No especificado',
      condicion:        i.condicion_animal || 'No especificada',
      contactoNombre:   i.nombre_contacto  || 'Contacto no registrado',
      contactoTelefono: i.telefono_contacto|| 'Teléfono no registrado',
      score:            i.urgency_score    || 0,
      prioridad:        this.obtenerPrioridad(i.urgency_score || 0),
      especie:          this.obtenerEspecie(i.tipo_animal),
      fotoUrl:          this.imagenUrl(i.imagen),
      estado:           i.estado || 'PENDIENTE',
      latitud:          i.lat_out  ?? null,
      longitud:         i.lng_out  ?? null,
      raw:              i,
    };
  }

  // ─────────────────────────────────────────
  // Getters computados
  // ─────────────────────────────────────────

  get puedeConfirmar(): boolean {
    return this.revisoInformacion &&
           this.tieneDisponibilidad &&
           this.aceptaSeguimiento &&
           this.aceptaSeguridad;
  }

  get progresoCompromiso(): number {
    const checks = [
      this.revisoInformacion,
      this.tieneDisponibilidad,
      this.aceptaSeguimiento,
      this.aceptaSeguridad,
    ];
    return (checks.filter(Boolean).length / checks.length) * 100;
  }

  get prioridadClase(): string {
    if (!this.caso) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (this.caso.prioridad === 'Urgente') return 'bg-red-100 text-red-700 border-red-200';
    if (this.caso.prioridad === 'Alta')    return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }
  // ── Campos nuevos del animal ──────────────

  get color(): string | null {
    return this.caso?.raw?.color_animal?.trim() || null;
  }

  get raza(): string | null {
    return this.caso?.raw?.raza_animal?.trim() || null;
  }

  get agresividad(): string | null {
    return this.caso?.raw?.agresividad_animal?.trim() || null;
  }

  /** Como reacciono el animal al ver al reportante. Es informacion de seguridad. */
  get avisoAgresividad(): { titulo: string; detalle: string; icono: string; clase: string; claseTexto: string } | null {
    switch (this.agresividad) {
      case 'agresivo':
        return {
          titulo: 'Gruñó o intentó morder',
          detalle: 'No te acerques sin equipo de contención. Considera pedir apoyo de otro voluntario.',
          icono: 'warning',
          clase: 'border-red-300 bg-red-50',
          claseTexto: 'text-red-800',
        };
      case 'asustadizo':
        return {
          titulo: 'Se alejó o huyó',
          detalle: 'Está asustado. Acércate despacio, sin movimientos bruscos ni ruidos fuertes.',
          icono: 'directions_run',
          clase: 'border-amber-300 bg-amber-50',
          claseTexto: 'text-amber-800',
        };
      case 'docil':
        return {
          titulo: 'Se dejó acercar',
          detalle: 'El reportante pudo aproximarse sin problema. Aun así, mantén precaución.',
          icono: 'volunteer_activism',
          clase: 'border-emerald-300 bg-emerald-50',
          claseTexto: 'text-emerald-800',
        };
      case 'no_evaluable':
        return {
          titulo: 'No se pudo evaluar',
          detalle: 'El reportante lo vio de lejos. Asume precaución máxima al acercarte.',
          icono: 'help',
          clase: 'border-slate-300 bg-slate-50',
          claseTexto: 'text-slate-700',
        };
      default:
        return null;
    }
  }

  get estadoLegible(): string {
    return this.caso?.estado.replace(/_/g, ' ').toLowerCase() ?? 'pendiente';
  }

  // ─────────────────────────────────────────
  // Utilidades privadas
  // ─────────────────────────────────────────

  imagenUrl(imagen: string | null): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }

  private obtenerTitulo(i: IncidenciaResponse): string {
    if (i.nombre_caso?.trim()) return i.nombre_caso.trim();
    const animal    = i.tipo_animal || 'Animal';
    const condicion = i.condicion_animal?.split(',')[0]?.trim() || 'sin condición';
    return `${animal} ${condicion}`.trim();
  }

  private tiempoRelativo(fecha: string | null): string {
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

  private obtenerPrioridad(score: number): 'Urgente' | 'Alta' | 'Moderada' {
    if (score >= 80) return 'Urgente';
    if (score >= 40) return 'Alta';
    return 'Moderada';
  }

  private obtenerEspecie(tipo: string | null): 'Perro' | 'Gato' | 'Otro' {
    const n = tipo?.toLowerCase();
    if (n === 'perro') return 'Perro';
    if (n === 'gato')  return 'Gato';
    return 'Otro';
  }
}