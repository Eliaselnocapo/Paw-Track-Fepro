import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-view-follow-up',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
  ],
  templateUrl: './view-follow-up.page.html',
  styleUrls: ['./view-follow-up.page.scss'],
})
export class ViewFollowUpPage implements OnInit {

  incidencia: IncidenciaResponse | null = null;
  seguimiento: any = null;   // respuesta de seguimientoPorFolio (estado, rescatista, etc.)

  cargando = true;
  errorCarga: string | null = null;

  pasos = ['En camino', 'En sitio', 'Rescatado'];
  pasoExpandido: number | null = null;

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

        // Seguimiento público (estado, si tiene rescatista). Si falla, no rompe.
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
  }

  // ─────────────────────────────────────────
  // Estado del caso
  // ─────────────────────────────────────────

  get estado(): string {
    return this.incidencia?.estado || 'PENDIENTE';
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
    const raw: string = this.incidencia?.caracteristicas?.trim() || '';
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
    const raw: string = this.incidencia?.caracteristicas || '';
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
}