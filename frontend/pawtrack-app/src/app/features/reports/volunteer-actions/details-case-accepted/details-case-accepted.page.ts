import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, RescateResponse } from '../../../../core/services/report.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-details-case-accepted',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
  ],
  templateUrl: './details-case-accepted.page.html',
  styleUrls: ['./details-case-accepted.page.scss'],
})
export class DetailsCaseAcceptedPage implements OnInit {

  rescate: RescateResponse | null = null;

  cargando = true;
  errorCarga: string | null = null;

  // Pasos del stepper (solo lectura)
  pasos = ['En camino', 'En sitio', 'Rescatado'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
  ) {}

  ngOnInit(): void {
    this.cargarCaso();
  }

  // ─────────────────────────────────────────
  // Carga: por folio buscamos el rescate en mis-rescates
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

    this.reportService.listarMisRescates().subscribe({
      next: (resp) => {
        const encontrado = resp.results.find(r => r.incidencia?.folio === folio);

        if (!encontrado) {
          this.errorCarga = 'Este caso no está entre tus rescates aceptados.';
          this.cargando = false;
          return;
        }

        this.rescate = encontrado;
        this.cargando = false;
      },
      error: () => {
        this.errorCarga = 'No se pudo cargar la información del caso.';
        this.cargando = false;
      },
    });
  }

  // ─────────────────────────────────────────
  // Getters de presentación
  // ─────────────────────────────────────────

  get titulo(): string {
    const i = this.rescate?.incidencia;
    return i?.nombre_caso?.trim() || `${i?.tipo_animal ?? 'Animal'} en incidencia`;
  }

  get descripcion(): string {
    return this.rescate?.incidencia?.['notas_animal']?.trim() || 'Sin notas registradas por el reportante.';
  }

  get ubicacion(): string {
    const i = this.rescate?.incidencia;
    if (i?.lat_out != null && i?.lng_out != null) {
      return `${i.lat_out.toFixed(5)}, ${i.lng_out.toFixed(5)}`;
    }
    return 'Ubicación no disponible';
  }

  get latitud(): number | null {
    return this.rescate?.incidencia?.lat_out ?? null;
  }

  get longitud(): number | null {
    return this.rescate?.incidencia?.lng_out ?? null;
  }

  get especie(): string {
    return this.rescate?.incidencia?.tipo_animal || 'No especificado';
  }

  get tamano(): string {
    return this.rescate?.incidencia?.['tamano_animal'] || 'No especificado';
  }

  get condicion(): string {
    return this.rescate?.incidencia?.['condicion_animal'] || 'No especificada';
  }

  get edad(): string {
    return this.rescate?.incidencia?.['edad_estimada'] || 'No especificada';
  }

  get peso(): string {
    return this.rescate?.incidencia?.['peso_estimado'] || 'No especificado';
  }

  get contactoNombre(): string {
    return this.rescate?.incidencia?.nombre_contacto || 'Contacto no registrado';
  }

  get contactoTelefono(): string {
    return this.rescate?.incidencia?.telefono_contacto || 'Teléfono no registrado';
  }

  get tiempo(): string {
    const fecha = this.rescate?.fecha_aceptacion;
    if (!fecha) return 'Fecha no disponible';
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    const hrs = Math.floor(min / 60);
    const dias = Math.floor(hrs / 24);
    if (min < 1) return 'Aceptado hace segundos';
    if (min < 60) return `Aceptado hace ${min} min`;
    if (hrs < 24) return `Aceptado hace ${hrs} h`;
    return `Aceptado hace ${dias} día${dias === 1 ? '' : 's'}`;
  }

  get score(): number {
    return this.rescate?.incidencia?.urgency_score ?? 0;
  }

  get prioridad(): 'Urgente' | 'Alta' | 'Moderada' {
    if (this.score >= 80) return 'Urgente';
    if (this.score >= 40) return 'Alta';
    return 'Moderada';
  }

  get prioridadClase(): string {
    if (this.prioridad === 'Urgente') return 'bg-red-100 text-red-700 border-red-200';
    if (this.prioridad === 'Alta')    return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }

  get estadoLegible(): string {
    switch (this.rescate?.estado) {
      case 'EN_CAMINO':  return 'En camino';
      case 'EN_SITIO':   return 'En sitio';
      case 'COMPLETADO': return 'Rescatado';
      case 'CANCELADO':  return 'Cancelado';
      default:           return 'Aceptado';
    }
  }

  // ─────────────────────────────────────────
  // Stepper (solo lectura)
  // ─────────────────────────────────────────

  get pasoActualIndex(): number {
    switch (this.rescate?.estado) {
      case 'COMPLETADO': return 2;
      case 'EN_SITIO':   return 1;
      default:           return 0; // EN_CAMINO
    }
  }

// Evaluación del voluntario en pares {label, valor}, SIN las notas clínicas
  get evaluacionItems(): { label: string; valor: string }[] {
    const raw: string = this.rescate?.incidencia?.['caracteristicas']?.trim() || '';
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

  // Solo las notas clínicas
  get notasClinicas(): string {
    const raw: string = this.rescate?.incidencia?.['caracteristicas'] || '';
    const parte = raw.split('|').map(p => p.trim()).find(p => p.toLowerCase().startsWith('notas clínicas'));
    return parte ? parte.split(':').slice(1).join(':').trim() : '';
  }

  // Desplegable del progreso
  progresoAbierto = false;
  toggleProgreso(): void { this.progresoAbierto = !this.progresoAbierto; }

  esPasoCompletado(i: number): boolean {
    return i < this.pasoActualIndex || this.rescate?.estado === 'COMPLETADO';
  }

  esPasoActivo(i: number): boolean {
    return i === this.pasoActualIndex && this.rescate?.estado !== 'COMPLETADO';
  }

  iconoPaso(i: number): string {
    return i === 0 ? 'directions_car' : i === 1 ? 'my_location' : 'verified';
  }

  imagenUrl(imagen: string | null | undefined): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }
  // Devuelve las entradas del historial que corresponden a un paso del stepper
  entradasDePaso(i: number): { timestamp: string; nota?: string }[] {
    const estadoBackend = i === 0 ? 'EN_CAMINO' : i === 1 ? 'EN_SITIO' : 'COMPLETADO';
    return (this.rescate?.historial ?? []).filter(e => e.estado === estadoBackend);
  }

  // Control de cuál paso está expandido (null = ninguno)
  pasoExpandido: number | null = null;
  togglePaso(i: number): void {
    this.pasoExpandido = this.pasoExpandido === i ? null : i;
  }

  // ─────────────────────────────────────────
  // Navegación
  // ─────────────────────────────────────────

  actualizarCaso(): void {
    if (this.rescate) {
      this.router.navigate(['/update-case', this.rescate.incidencia?.folio]);
    }
  }

  volver(): void {
    this.router.navigate(['/accepted-cases']);
  }
}