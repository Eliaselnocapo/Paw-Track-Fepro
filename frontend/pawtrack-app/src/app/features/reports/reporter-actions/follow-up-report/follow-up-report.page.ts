import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';

type SituacionActual =
  | ''
  | 'sigue_en_lugar'
  | 'se_movio'
  | 'ya_no_esta'
  | 'empeoro'
  | 'alguien_ayudo';

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

  situacionesDisponibles = [
    { valor: 'sigue_en_lugar' as SituacionActual, texto: 'Sigue en el mismo lugar' },
    { valor: 'se_movio' as SituacionActual, texto: 'Se movió de lugar' },
    { valor: 'ya_no_esta' as SituacionActual, texto: 'Ya no está en la zona' },
    { valor: 'empeoro' as SituacionActual, texto: 'Su estado empeoró' },
    { valor: 'alguien_ayudo' as SituacionActual, texto: 'Alguien ya lo ayudó' },
  ];

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

    // Los booleanos se inicializan en falso para este nuevo registro de seguimiento.
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

  calcularUrgencia(): number {
    let urgencia = 20; // Base
    
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
    
    // Intervención
    if (this.reporte.intervencion.aguaComida) detalles.push("Ciudadano brindó agua/comida.");
    if (this.reporte.intervencion.resguardado) detalles.push("El animal está resguardado temporalmente.");
    if (this.reporte.intervencion.huyo) detalles.push("El animal huye al acercarse.");
    if (this.reporte.intervencion.soloObservando) detalles.push("Ciudadano solo observando, sin interacción.");

    // Entorno
    if (this.reporte.riesgoEntorno.trafico) detalles.push("Alto riesgo de tráfico / avenidas.");
    if (this.reporte.riesgoEntorno.climaExtremo) detalles.push("Expuesto a clima extremo.");
    if (this.reporte.riesgoEntorno.dificilAcceso) detalles.push("Zona de difícil acceso.");

    // Señas / Salud
    if (this.reporte.senasParticulares.collar) detalles.push("Tiene collar/correa (Posible dueño).");
    if (this.reporte.senasParticulares.gestanteCachorros) detalles.push("Hembra gestante o con cachorros.");
    if (this.reporte.senasParticulares.heridaVisible) detalles.push("¡ALERTA! Herida visible.");

    // Temperamento
    if (this.reporte.temperamento.docil) detalles.push("Temperamento dócil.");
    if (this.reporte.temperamento.asustado) detalles.push("El animal está asustado/tiembla.");
    if (this.reporte.temperamento.agresivo) detalles.push("¡ALERTA! Temperamento agresivo/defensiva.");

    return detalles;
  }

  enviar(): void {
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
      // Se eliminaron edad y peso del envío
    };

    this.reportService.actualizarReporte(this.reporteNumericId, payload).subscribe({
      next: () => {
        this.guardando = false;
        this.mensajeExito = 'Seguimiento guardado correctamente. Los voluntarios ya fueron notificados.';
        this.reporte.observaciones = '';
        this.reporte.situacionActual = '';
        // Puedes resetear los checkboxes aquí si quieres, o dejar que el user navegue
      },
      error: () => {
        this.guardando = false;
        this.error = 'No se pudo guardar el seguimiento. Intenta de nuevo.';
      },
    });
  }

  volverDashboard(): void {
    this.router.navigate(['/dashboards/reporter']);
  }
}