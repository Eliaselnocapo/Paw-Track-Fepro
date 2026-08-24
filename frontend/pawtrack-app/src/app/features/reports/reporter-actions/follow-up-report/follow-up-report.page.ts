import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';
import { RevealDirective } from 'src/app/shared/directives/reveal.directive';

type SituacionActual = '' | 'sigue_en_lugar' | 'se_movio' | 'empeoro';

type MotivoCancelacion =
  | ''
  | 'alguien_ayudo'
  | 'no_se_encuentra'
  | 'ya_no_necesita_ayuda'
  | 'error_duplicado'
  | 'otro';

type ModoFormulario = 'actualizar' | 'cancelar';

interface FollowUpReportViewModel {
  folio: string;
  nombreCaso: string;
  estado: string;
  tipoAnimal: string;
  tamanoAnimal: string;
  condicionAnimal: string;
  ubicacion: string;
  situacionActual: SituacionActual;
  observaciones: string;
  intervencion: {
    aguaComida: boolean;
    resguardado: boolean;
    huyo: boolean;
    soloObservando: boolean;
  };
  riesgoEntorno: {
    trafico: boolean;
    climaExtremo: boolean;
    dificilAcceso: boolean;
  };
  senasParticulares: {
    collar: boolean;
    gestanteCachorros: boolean;
    heridaVisible: boolean;
  };
  temperamento: {
    docil: boolean;
    asustado: boolean;
    agresivo: boolean;
  };
}

@Component({
  selector: 'app-follow-up-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    RouterLink,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
  ],
  templateUrl: './follow-up-report.page.html',
  styleUrls: ['./follow-up-report.page.scss'],
})
export class FollowUpReportPage implements OnInit {
  esPantallaGrande = window.innerWidth >= 768;

  private reporteNumericId!: number;

  cargando = true;
  guardando = false;
  error: string | null = null;
  mensajeExito: string | null = null;

  // ─────────────────────────────────────────
  // Modo: actualizar seguimiento vs. cancelar reporte
  // ─────────────────────────────────────────

  modo: ModoFormulario = 'actualizar';

  situacionesDisponibles = [
    { valor: 'sigue_en_lugar' as SituacionActual, texto: 'Sigue en el mismo lugar', icono: 'location_on', descripcion: 'El animal continúa en la ubicación reportada.' },
    { valor: 'se_movio' as SituacionActual, texto: 'Se movió de lugar', icono: 'moving', descripcion: 'La ubicación cambió o el animal avanzó a otra zona.' },
    { valor: 'empeoro' as SituacionActual, texto: 'Su estado empeoró', icono: 'warning', descripcion: 'Se ve más herido, débil o en peligro.' },
  ];

  motivosCancelacion: { valor: MotivoCancelacion; texto: string; descripcion: string; icono: string; color: string }[] = [
    {
      valor: 'alguien_ayudo',
      texto: 'Alguien externo ya lo ayudó',
      descripcion: 'Un vecino, refugio o rescatista ajeno a la app ya lo auxilió.',
      icono: 'volunteer_activism',
      color: 'emerald',
    },
    {
      valor: 'no_se_encuentra',
      texto: 'Ya no se le encuentra',
      descripcion: 'No lo ubicas en la zona y no sabes a dónde fue.',
      icono: 'visibility_off',
      color: 'amber',
    },
    {
      valor: 'ya_no_necesita_ayuda',
      texto: 'Ya no necesita ayuda',
      descripcion: 'Se recuperó por su cuenta o se fue caminando sin problema.',
      icono: 'pets',
      color: 'blue',
    },
    {
      valor: 'error_duplicado',
      texto: 'Fue un error o está duplicado',
      descripcion: 'Reportaste por equivocación o ya existía otro reporte igual.',
      icono: 'error',
      color: 'slate',
    },
    {
      valor: 'otro',
      texto: 'Otro motivo',
      descripcion: 'Cuéntanos brevemente qué pasó.',
      icono: 'more_horiz',
      color: 'slate',
    },
  ];

  motivoSeleccionado: MotivoCancelacion = '';
  motivoOtroTexto = '';
  cancelando = false;
  reporteCancelado = false;

  reporte: FollowUpReportViewModel = {
    folio: '',
    nombreCaso: '',
    estado: '',
    tipoAnimal: '',
    tamanoAnimal: '',
    condicionAnimal: '',
    ubicacion: '',
    situacionActual: '',
    observaciones: '',
    intervencion: { aguaComida: false, resguardado: false, huyo: false, soloObservando: false },
    riesgoEntorno: { trafico: false, climaExtremo: false, dificilAcceso: false },
    senasParticulares: { collar: false, gestanteCachorros: false, heridaVisible: false },
    temperamento: { docil: false, asustado: false, agresivo: false },
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService
  ) {}

  ngOnInit(): void {
    const folio = this.route.snapshot.paramMap.get('folio');

    if (!folio) {
      this.error = 'No se recibió un folio válido.';
      this.cargando = false;
      return;
    }

    this.reportService.obtenerReportePorFolio(folio).subscribe({
      next: (data) => this.poblarFormulario(data),
      error: () => {
        this.error = 'No se pudo cargar el reporte. Verifica que el folio sea correcto.';
        this.cargando = false;
      },
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.esPantallaGrande = window.innerWidth >= 768;
  }

  private poblarFormulario(data: IncidenciaResponse): void {
    this.reporteNumericId = data.id;

    this.reporte.folio = data.folio ?? String(data.id);
    this.reporte.nombreCaso = data.nombre_caso ?? 'Reporte sin nombre';
    this.reporte.estado = data.estado ?? 'PENDIENTE';
    this.reporte.tipoAnimal = data.tipo_animal ?? '';
    this.reporte.tamanoAnimal = data.tamano_animal ?? '';
    this.reporte.condicionAnimal = data.condicion_animal ?? '';
    this.reporte.ubicacion = this.obtenerTextoUbicacion(data);
    this.reporte.observaciones = '';

    this.cargando = false;
  }

  private obtenerTextoUbicacion(data: IncidenciaResponse): string {
    const lat = data.lat_out;
    const lng = data.lng_out;
    if (lat != null && lng != null) {
      return `${lat}, ${lng}`;
    }
    return 'Ubicación registrada en el reporte original';
  }

  // ─────────────────────────────────────────
  // Modo
  // ─────────────────────────────────────────

  get puedeCancelar(): boolean {
    const estado = this.reporte?.estado;
    return estado === 'PENDIENTE' || estado === 'VALIDADO';
  }

  cambiarModo(nuevo: ModoFormulario): void {
    if (nuevo === 'cancelar' && !this.puedeCancelar) return;
    this.modo = nuevo;
    this.error = null;
  }

  // ─────────────────────────────────────────
  // Modo actualizar: urgencia y payload de seguimiento
  // ─────────────────────────────────────────

  calcularUrgencia(): number {
    let urgencia = 20;

    if (this.reporte.senasParticulares.heridaVisible) urgencia += 50;
    if (this.reporte.temperamento.agresivo) urgencia += 20;
    if (this.reporte.riesgoEntorno.trafico || this.reporte.riesgoEntorno.climaExtremo) urgencia += 20;
    if (this.reporte.senasParticulares.gestanteCachorros) urgencia += 15;

    return Math.min(100, urgencia);
  }

  obtenerTextoUrgencia(): string {
    const urgencia = this.calcularUrgencia();
    if (urgencia >= 90) return 'CRÍTICA';
    if (urgencia >= 60) return 'ALTA';
    if (urgencia >= 35) return 'MEDIA';
    return 'BAJA';
  }

  obtenerTextoSituacion(situacion: SituacionActual): string {
    const encontrada = this.situacionesDisponibles.find((item) => item.valor === situacion);
    return encontrada?.texto ?? 'Sin especificar';
  }

  private recopilarAtributosVerdaderos(): string[] {
    const detalles: string[] = [];

    if (this.reporte.intervencion.aguaComida) detalles.push("Ciudadano brindó agua/comida.");
    if (this.reporte.intervencion.resguardado) detalles.push("El animal está resguardado temporalmente.");
    if (this.reporte.intervencion.huyo) detalles.push("El animal huye al acercarse.");
    if (this.reporte.intervencion.soloObservando) detalles.push("Ciudadano solo observando, sin interacción.");

    if (this.reporte.riesgoEntorno.trafico) detalles.push("Alto riesgo de tráfico / avenidas.");
    if (this.reporte.riesgoEntorno.climaExtremo) detalles.push("Expuesto a clima extremo.");
    if (this.reporte.riesgoEntorno.dificilAcceso) detalles.push("Zona de difícil acceso.");

    if (this.reporte.senasParticulares.collar) detalles.push("Tiene collar/correa (Posible dueño).");
    if (this.reporte.senasParticulares.gestanteCachorros) detalles.push("Hembra gestante o con cachorros.");
    if (this.reporte.senasParticulares.heridaVisible) detalles.push("¡ALERTA! Herida visible.");

    if (this.reporte.temperamento.docil) detalles.push("Temperamento dócil.");
    if (this.reporte.temperamento.asustado) detalles.push("El animal está asustado/tiembla.");
    if (this.reporte.temperamento.agresivo) detalles.push("¡ALERTA! Temperamento agresivo/defensiva.");

    return detalles;
  }

  enviarActualizacion(): void {
    this.error = null;
    this.mensajeExito = null;

    if (!this.reporte.situacionActual) {
      this.error = 'Selecciona la situación actual del animal.';
      return;
    }

    this.guardando = true;
    const detallesExtra = this.recopilarAtributosVerdaderos();

    const textoSeguimiento = `
--- ACTUALIZACIÓN DE SEGUIMIENTO ---
Situación actual: ${this.obtenerTextoSituacion(this.reporte.situacionActual)}
Urgencia Calculada: ${this.obtenerTextoUrgencia()}

Condiciones Observadas:
${detallesExtra.length > 0 ? detallesExtra.map(d => '- ' + d).join('\n') : '- Ninguna condición específica marcada.'}

Nota adicional del reportante:
${this.reporte.observaciones.trim() || 'Sin comentarios adicionales.'}
    `.trim();

    const payload = {
      caracteristicas: textoSeguimiento,
      urgency_score: this.calcularUrgencia(),
    };

    this.reportService.actualizarReporte(this.reporteNumericId, payload).subscribe({
      next: () => {
        this.guardando = false;
        this.mensajeExito = 'Seguimiento guardado correctamente. Los voluntarios ya fueron notificados.';
        this.reporte.observaciones = '';
        this.reporte.situacionActual = '';
      },
      error: () => {
        this.guardando = false;
        this.error = 'No se pudo guardar el seguimiento. Intenta de nuevo.';
      },
    });
  }

  // ─────────────────────────────────────────
  // Modo cancelar
  // ─────────────────────────────────────────

  get textoMotivoFinal(): string {
    if (this.motivoSeleccionado === 'otro') {
      return this.motivoOtroTexto.trim();
    }
    const encontrado = this.motivosCancelacion.find(m => m.valor === this.motivoSeleccionado);
    return encontrado?.texto ?? '';
  }

  get puedeConfirmarCancelacion(): boolean {
    return this.textoMotivoFinal.length > 0;
  }

  enviarCancelacion(): void {
    this.error = null;
    this.mensajeExito = null;

    if (!this.motivoSeleccionado) {
      this.error = 'Selecciona el motivo de la cancelación.';
      return;
    }
    if (!this.puedeConfirmarCancelacion) {
      this.error = 'Escribe brevemente el motivo.';
      return;
    }

    this.cancelando = true;

    this.reportService.cancelarReporte(this.reporte.folio, this.textoMotivoFinal).subscribe({
      next: () => {
        this.cancelando = false;
        this.reporteCancelado = true;
        this.reporte.estado = 'CANCELADO';
        this.mensajeExito = 'Reporte cancelado. Ya no aparecerá disponible para los voluntarios.';
      },
      error: (err) => {
        this.cancelando = false;
        this.error =
          err?.error?.detail
            || (err?.status === 400
              ? 'Este caso ya no se puede cancelar (probablemente un voluntario ya lo tomó).'
              : 'No se pudo cancelar el reporte. Intenta de nuevo.');
      },
    });
  }

  claseMotivoSeleccionado(color: string): string {
    switch (color) {
      case 'emerald': return 'border-emerald-500 bg-emerald-50';
      case 'amber':   return 'border-amber-500 bg-amber-50';
      case 'blue':    return 'border-blue-500 bg-blue-50';
      default:        return 'border-slate-400 bg-slate-50';
    }
  }

  claseIconoMotivo(color: string, seleccionado: boolean): string {
    if (!seleccionado) return 'text-slate-500';
    switch (color) {
      case 'emerald': return 'text-emerald-600';
      case 'amber':   return 'text-amber-600';
      case 'blue':    return 'text-blue-600';
      default:        return 'text-slate-600';
    }
  }

  volverDashboard(): void {
    this.router.navigate(['/dashboards/reporter']);
  }
}