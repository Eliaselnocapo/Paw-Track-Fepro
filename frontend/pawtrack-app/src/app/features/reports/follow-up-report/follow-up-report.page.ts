import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, IncidenciaResponse } from '../../../core/services/report.service';

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
  edadEstimada: string;
  pesoEstimado: string;
  condiciones: {
    herido: boolean;
    deshidratado: boolean;
    asustado: boolean;
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
    {
      valor: 'sigue_en_lugar' as SituacionActual,
      texto: 'Sigue en el mismo lugar',
      descripcion: 'El animal continúa en la ubicación reportada.',
    },
    {
      valor: 'se_movio' as SituacionActual,
      texto: 'Se movió de lugar',
      descripcion: 'El animal cambió de zona o avanzó a otro punto.',
    },
    {
      valor: 'ya_no_esta' as SituacionActual,
      texto: 'Ya no está en la zona',
      descripcion: 'No logras encontrarlo en el lugar del reporte.',
    },
    {
      valor: 'empeoro' as SituacionActual,
      texto: 'Su estado empeoró',
      descripcion: 'Se ve más débil, herido o en peligro.',
    },
    {
      valor: 'alguien_ayudo' as SituacionActual,
      texto: 'Alguien ya lo ayudó',
      descripcion: 'Una persona, vecino o rescatista ya intervino.',
    },
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
    edadEstimada: '',
    pesoEstimado: '',
    condiciones: {
      herido: false,
      deshidratado: false,
      asustado: false,
    },
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

    this.reporte.edadEstimada = data.edad_estimada ?? '';
    this.reporte.pesoEstimado = data.peso_estimado ?? '';

    this.poblarCondicionesDesdeDatos(data);

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

  private poblarCondicionesDesdeDatos(data: IncidenciaResponse): void {
    const condicion = `${data.condicion_animal ?? ''} ${data.caracteristicas ?? ''} ${data.notas_animal ?? ''}`.toLowerCase();

    this.reporte.condiciones.herido =
      condicion.includes('herido') ||
      condicion.includes('herida') ||
      condicion.includes('sangre') ||
      condicion.includes('lastimado');

    this.reporte.condiciones.deshidratado =
      condicion.includes('deshidratado') ||
      condicion.includes('deshidratada');

    this.reporte.condiciones.asustado =
      condicion.includes('asustado') ||
      condicion.includes('asustada') ||
      condicion.includes('agresivo') ||
      condicion.includes('agresiva');

    if (
      !this.reporte.condiciones.herido &&
      !this.reporte.condiciones.deshidratado &&
      !this.reporte.condiciones.asustado
    ) {
      const score = data.urgency_score ?? 0;

      this.reporte.condiciones.herido = score >= 50;
      this.reporte.condiciones.deshidratado = score >= 85;
      this.reporte.condiciones.asustado =
        score === 15 || score === 65 || score === 100;
    }
  }

  calcularUrgencia(): number {
    const { herido, deshidratado, asustado } = this.reporte.condiciones;

    let urgencia = 0;

    if (herido) urgencia += 50;
    if (deshidratado) urgencia += 35;
    if (asustado) urgencia += 15;

    return Math.min(100, urgencia);
  }

  obtenerTextoUrgencia(): string {
    const urgencia = this.calcularUrgencia();

    if (urgencia >= 100) return 'CRÍTICA';
    if (urgencia >= 75) return 'ALTA';
    if (urgencia >= 35) return 'MEDIA';

    return 'BAJA';
  }

  obtenerColorUrgencia(): string {
    const urgencia = this.calcularUrgencia();

    if (urgencia >= 100) return 'text-red-950';
    if (urgencia >= 75) return 'text-red-600';
    if (urgencia >= 35) return 'text-amber-600';

    return 'text-green-600';
  }

  obtenerBarraUrgencia(): number {
    return this.calcularUrgencia();
  }

  obtenerTextoSituacion(situacion: SituacionActual): string {
    const encontrada = this.situacionesDisponibles.find(
      (item) => item.valor === situacion
    );

    return encontrada?.texto ?? 'Sin especificar';
  }

  enviar(): void {
    this.error = null;
    this.mensajeExito = null;

    if (!this.reporte.situacionActual) {
      this.error = 'Selecciona la situación actual del animal.';
      return;
    }

    if (!this.reporte.observaciones.trim()) {
      this.error = 'Agrega una nota breve de seguimiento.';
      return;
    }

    this.guardando = true;

    const textoSeguimiento = `
Seguimiento del reportante:
Situación actual: ${this.obtenerTextoSituacion(this.reporte.situacionActual)}
Nota: ${this.reporte.observaciones.trim()}
Urgencia actual: ${this.obtenerTextoUrgencia()}
Fecha: ${new Date().toLocaleString()}
    `.trim();

    const payload = {
      caracteristicas: textoSeguimiento,
      urgency_score: this.calcularUrgencia(),
      edad_estimada: String(this.reporte.edadEstimada ?? ''),
      peso_estimado: String(this.reporte.pesoEstimado ?? ''),
    };

    this.reportService.actualizarReporte(this.reporteNumericId, payload).subscribe({
      next: () => {
        this.guardando = false;
        this.mensajeExito = 'Seguimiento guardado correctamente.';
        this.reporte.observaciones = '';
        this.reporte.situacionActual = '';
      },
      error: () => {
        this.guardando = false;
        this.error = 'No se pudo guardar el seguimiento. Intenta de nuevo.';
      },
    });
  }

  volverDashboard(): void {
    this.router.navigate(['/dashboard/reporter']);
  }
}