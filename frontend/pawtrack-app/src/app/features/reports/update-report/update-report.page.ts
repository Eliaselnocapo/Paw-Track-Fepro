import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, IncidenciaResponse } from '../../../core/services/report.service';

@Component({
  selector: 'app-update-report',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, NavbarWebComponent, FooterWebComponent],
  templateUrl: './update-report.page.html',
  styleUrls: ['./update-report.page.scss'],
})
export class UpdateReportPage implements OnInit {
  esPantallaGrande = window.innerWidth >= 768;

  // ID numérico del reporte (obtenido tras cargar por folio)
  private reporteNumericId!: number;

  cargando  = true;
  guardando = false;
  error: string | null = null;
  mensajeExito: string | null = null;

  estadosDisponibles = [
    'PENDIENTE',
    'EN_PROCESO',
    'EN_REVISION',
    'CERRADO',
    'En ruta a clínica',
    'En observación',
    'Rescatado',
    'Estable',
    'Crítico',
  ];

  reporte = {
    folio:        '',
    estado:       'PENDIENTE',
    condiciones: { herido: false, deshidratado: false, asustado: false },
    observaciones:  '',
    edadEstimada:   '',
    pesoEstimado:   '',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
  ) {}

  ngOnInit(): void {
    const folio = this.route.snapshot.paramMap.get('folio') ?? '';
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
    this.reporteNumericId  = data.id;
    this.reporte.folio         = data.folio ?? String(data.id);
    this.reporte.estado        = data.estado ?? 'PENDIENTE';
    this.reporte.observaciones = data.caracteristicas ?? '';
    this.reporte.edadEstimada  = data.edad_estimada   ?? '';
    this.reporte.pesoEstimado  = data.peso_estimado   ?? '';

    // Aproximar condiciones desde el urgency_score del back
    const s = data.urgency_score ?? 0;
    this.reporte.condiciones.herido       = s >= 50;
    this.reporte.condiciones.deshidratado = s >= 85;
    this.reporte.condiciones.asustado     = s % 50 >= 15; // preserva asustado aunque haya herido

    this.cargando = false;
  }

  calcularUrgencia(): number {
    const { herido, deshidratado, asustado } = this.reporte.condiciones;
    let u = 0;
    if (herido)       u += 50;
    if (deshidratado) u += 35;
    if (asustado)     u += 15;
    return u;
  }

  obtenerTextoUrgencia(): string {
    const u = this.calcularUrgencia();
    if (u === 100) return 'CRÍTICA';
    if (u >= 75)   return 'ALTA';
    if (u >= 35)   return 'MEDIA';
    return 'BAJA';
  }

  obtenerColorUrgencia(): string {
    const u = this.calcularUrgencia();
    if (u === 100) return 'text-red-950';
    if (u >= 75)   return 'text-error';
    if (u >= 35)   return 'text-amber-600';
    return 'text-green-600';
  }

  obtenerBarraUrgencia(): number {
    return Math.min(100, Math.max(0, this.calcularUrgencia()));
  }

  enviar(): void {
    this.guardando    = true;
    this.mensajeExito = null;
    this.error        = null;

    this.reportService.actualizarReporte(this.reporteNumericId, {
      estado:          this.reporte.estado,
      caracteristicas: this.reporte.observaciones,
      urgency_score:   this.calcularUrgencia(),
      edad_estimada:   this.reporte.edadEstimada,
      peso_estimado:   this.reporte.pesoEstimado,
    }).subscribe({
      next: () => {
        this.mensajeExito = '¡Reporte actualizado correctamente!';
        this.guardando = false;
        setTimeout(() => this.router.navigate(['/reports/list-reports']), 1500);
      },
      error: (err) => {
        if (err.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        this.error     = err.status === 403
          ? 'No tienes permiso para editar este reporte.'
          : 'Error al guardar. Intenta de nuevo.';
        this.guardando = false;
      },
    });
  }
}
