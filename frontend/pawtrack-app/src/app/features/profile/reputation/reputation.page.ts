import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

// TODO backend: reemplazar por el servicio real cuando exista
// GET /api/usuarios/{id}/reputacion/
import { ReputacionService, ReputacionResponse, LogroTimeline, HistorialCaso, EstadoValidacion } from '../../../core/services/reputation.service';
// (mismo import, sin cambios — se deja explícito para claridad)
import { RevealDirective } from 'src/app/shared/directives/reveal.directive';


interface NivelReputacion {
  clave: string;
  nombre: string;
  descripcion: string;
  minScore: number;
  maxScore: number | null; // null = sin techo (nivel máximo)
  icono: string;
  colorClase: string;      // texto + fondo del badge
  colorBarra: string;      // color de la barra de progreso
}

@Component({
  selector: 'app-reputation',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
  ],
  templateUrl: './reputation.page.html',
  styleUrls: ['./reputation.page.scss'],
})
export class ReputationPage implements OnInit {

  cargando = true;
  error: string | null = null;
  vistaTecnica = false;

  datos: ReputacionResponse | null = null;

  paginaActualHistorial = 1;
  historialPorPagina = 6;

  // ─────────────────────────────────────────
  // Definición de niveles (ajustable a futuro)
  // ─────────────────────────────────────────
  private readonly niveles: NivelReputacion[] = [
    {
      clave: 'nuevo',
      nombre: 'Nuevo en la comunidad',
      descripcion: 'Acabas de empezar a colaborar con PawTrack.',
      minScore: 0,
      maxScore: 19,
      icono: 'eco',
      colorClase: 'bg-slate-100 text-slate-700 border-slate-200',
      colorBarra: '#94a3b8',
    },
    {
      clave: 'aliado',
      nombre: 'Aliado comunitario',
      descripcion: 'Ya eres una presencia constante ayudando a reportar y dar seguimiento.',
      minScore: 20,
      maxScore: 49,
      icono: 'volunteer_activism',
      colorClase: 'bg-blue-50 text-primary border-blue-100',
      colorBarra: '#0058be',
    },
    {
      clave: 'confiable',
      nombre: 'Rescatista confiable',
      descripcion: 'Tu historial demuestra compromiso real con los casos que tomas.',
      minScore: 50,
      maxScore: 99,
      icono: 'shield_person',
      colorClase: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      colorBarra: '#10b981',
    },
    {
      clave: 'guardian',
      nombre: 'Guardián PawTrack',
      descripcion: 'Nivel máximo: tu impacto en la red es ejemplar.',
      minScore: 100,
      maxScore: null,
      icono: 'verified',
      colorClase: 'bg-amber-50 text-amber-700 border-amber-200',
      colorBarra: '#f59e0b',
    },
  ];

  constructor(private reputacionService: ReputacionService) {}

  ngOnInit(): void {
    this.cargarReputacion();
  }

  

  cargarReputacion(): void {
    this.cargando = true;
    this.error = null;

    const userId = this.getUserIdFromToken();
    if (!userId) {
      this.error = 'Debes iniciar sesión para ver tu reputación.';
      this.cargando = false;
      return;
    }

    this.reputacionService.obtenerReputacion(userId).subscribe({
      next: (data) => {
        this.datos = data;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar tu reputación. Intenta de nuevo.';
        this.cargando = false;
      },
    });
  }

  // ─────────────────────────────────────────
  // Cálculos derivados
  // ─────────────────────────────────────────

  get nivelActual(): NivelReputacion {
    const score = this.datos?.score ?? 0;
    return (
      this.niveles.find(
        (n) => score >= n.minScore && (n.maxScore === null || score <= n.maxScore)
      ) ?? this.niveles[0]
    );
  }

  get siguienteNivel(): NivelReputacion | null {
    const idx = this.niveles.findIndex((n) => n.clave === this.nivelActual.clave);
    return idx >= 0 && idx < this.niveles.length - 1 ? this.niveles[idx + 1] : null;
  }

  get esNivelMaximo(): boolean {
    return this.siguienteNivel === null;
  }

  get progresoPorcentaje(): number {
    if (this.esNivelMaximo) return 100;

    const score = this.datos?.score ?? 0;
    const min = this.nivelActual.minScore;
    const max = this.nivelActual.maxScore ?? min + 1;

    const progreso = ((score - min) / (max - min + 1)) * 100;
    return Math.min(100, Math.max(0, Math.round(progreso)));
  }

  get puntosParaSiguienteNivel(): number {
    if (!this.siguienteNivel || !this.datos) return 0;
    return Math.max(0, this.siguienteNivel.minScore - this.datos.score);
  }

  get logros(): LogroTimeline[] {
    return this.datos?.timeline ?? [];
  }

  get historialCasos(): HistorialCaso[] {
    return this.datos?.historialCasos ?? [];
  }

  iconoLogro(tipo: LogroTimeline['tipo']): string {
    switch (tipo) {
      case 'reporte': return 'campaign';
      case 'aceptado': return 'directions_run';
      case 'cerrado': return 'task_alt';
      case 'seguimiento': return 'update';
      case 'nivel': return 'military_tech';
      default: return 'pets';
    }
  }

  etiquetaEstado(estado: EstadoValidacion): string {
    switch (estado) {
      case 'validado': return 'Validado';
      case 'falso_positivo': return 'Falso positivo';
      case 'pendiente': return 'Pendiente';
    }
  }

  claseEstado(estado: EstadoValidacion): string {
    switch (estado) {
      case 'validado': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'falso_positivo': return 'bg-red-50 text-error border-red-200';
      case 'pendiente': return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  iconoEstado(estado: EstadoValidacion): string {
    switch (estado) {
      case 'validado': return 'check_circle';
      case 'falso_positivo': return 'cancel';
      case 'pendiente': return 'pending';
    }
  }

  get impactoFraudePorcentaje(): number {
    const impacto = Math.abs(this.datos?.impactoFraude ?? 0);
    return Math.min(100, impacto);
  }

  // ─────────────────────────────────────────
  // Gauge circular (SVG) — mismo dato que la barra, otra forma
  // ─────────────────────────────────────────

  private readonly radioGauge = 54;
  readonly circunferenciaGauge = 2 * Math.PI * this.radioGauge;

  /** Score visual del gauge sobre 100 (tope visual, aunque el score real pueda superarlo en niveles altos) */
  get scoreGaugePorcentaje(): number {
    const score = this.datos?.score ?? 0;
    return Math.min(100, Math.round((score / 100) * 100));
  }

  get dashOffsetGauge(): number {
    const progreso = this.scoreGaugePorcentaje / 100;
    return this.circunferenciaGauge * (1 - progreso);
  }

  private getUserIdFromToken(): number | null {
    const token = localStorage.getItem('pawtrack_access');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id ?? null;
    } catch { return null; }
  }

  get historialPaginado(): HistorialCaso[] {
    const inicio = (this.paginaActualHistorial - 1) * this.historialPorPagina;
    return this.historialCasos.slice(inicio, inicio + this.historialPorPagina);
  }

  get totalPaginasHistorial(): number {
    return Math.ceil(this.historialCasos.length / this.historialPorPagina) || 1;
  }

  get paginasHistorial(): number[] {
    return Array.from({ length: this.totalPaginasHistorial }, (_, i) => i + 1);
  }

  get inicioPaginaHistorial(): number {
    return this.historialCasos.length === 0 ? 0 : (this.paginaActualHistorial - 1) * this.historialPorPagina + 1;
  }

  get finPaginaHistorial(): number {
    return Math.min(this.paginaActualHistorial * this.historialPorPagina, this.historialCasos.length);
  }

  cambiarPaginaHistorial(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginasHistorial) {
      this.paginaActualHistorial = pagina;
    }
  }
}