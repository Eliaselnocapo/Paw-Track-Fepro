import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, RescateResponse, EntradaHistorial } from '../../../../core/services/report.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-update-case',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
  ],
  templateUrl: './update-case.page.html',
  styleUrls: ['./update-case.page.scss'],
})
export class UpdateCasePage implements OnInit {

  rescate: RescateResponse | null = null;

  cargando = true;
  errorCarga: string | null = null;

  // ── Ficha clínica (form) ──────────────────────────────────
  ficha = {
    peso: '',
    edad: '',            // cachorro | joven | adulto | senior
    sexo: '',            // macho | hembra | indeterminado
    esterilizado: '',    // si | no | desconocido
    salud: '',           // estable | delicado | critico
    temperamento: '',    // docil | asustadizo | agresivo | no_evaluable
    notas: '',
  };

  guardandoFicha = false;
  fichaOk = false;
  errorFicha: string | null = null;

  // ── Cierre del caso ───────────────────────────────────────
  foto: File | null = null;
  fotoPreview: string | null = null;
  cerrando = false;
  errorCierre: string | null = null;

  // ── Bitácora de avance ────────────────────────────────────
  bitacoraAbierta = true;

  avance = {
    estado: '' as '' | 'EN_SITIO' | 'COMPLETADO' | 'CANCELADO',
    nota: '',
  };

  registrandoAvance = false;
  avanceOk = false;
  errorAvance: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
  ) {}

  ngOnInit(): void {
    this.cargarCaso();
  }

  // ─────────────────────────────────────────
  // Carga
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
        this.precargarFicha();
        this.cargando = false;
      },
      error: () => {
        this.errorCarga = 'No se pudo cargar la información del caso.';
        this.cargando = false;
      },
    });
  }

  // Precarga datos que ya existan en la incidencia
  private precargarFicha(): void {
    const i = this.rescate?.incidencia;
    if (!i) return;

    this.ficha.peso  = (i['peso_estimado'] as string) || '';
    this.ficha.edad  = (i['edad_estimada'] as string) || '';
  }

  // ─────────────────────────────────────────
  // Guardar ficha clínica → incidencia
  // ─────────────────────────────────────────

  guardarFicha(): void {
    const incidenciaId = this.rescate?.incidencia?.id;
    if (!incidenciaId || this.guardandoFicha) return;

    this.guardandoFicha = true;
    this.fichaOk = false;
    this.errorFicha = null;

    // Los campos sin columna propia se guardan concatenados en "caracteristicas".
    const extras: string[] = [];
    if (this.ficha.sexo)         extras.push(`Sexo: ${this.etiqueta('sexo', this.ficha.sexo)}`);
    if (this.ficha.esterilizado) extras.push(`Esterilizado: ${this.etiqueta('esterilizado', this.ficha.esterilizado)}`);
    if (this.ficha.salud)        extras.push(`Salud: ${this.etiqueta('salud', this.ficha.salud)}`);
    if (this.ficha.temperamento) extras.push(`Temperamento: ${this.etiqueta('temperamento', this.ficha.temperamento)}`);
    if (this.ficha.notas.trim()) extras.push(`Notas clínicas: ${this.ficha.notas.trim()}`);

    this.reportService.actualizarReporte(incidenciaId, {
      peso_estimado:   this.ficha.peso || undefined,
      edad_estimada:   this.ficha.edad || undefined,
      caracteristicas: extras.length ? extras.join(' | ') : undefined,
    }).subscribe({
      next: () => {
        this.guardandoFicha = false;
        this.fichaOk = true;
      },
      error: () => {
        this.guardandoFicha = false;
        this.errorFicha = 'No se pudo guardar la ficha. Intenta de nuevo.';
      },
    });
  }

  // ─────────────────────────────────────────
  // Bitácora de avance → rescate
  // ─────────────────────────────────────────

  get historial(): EntradaHistorial[] {
    return this.rescate?.historial ?? [];
  }

  toggleBitacora(): void {
    this.bitacoraAbierta = !this.bitacoraAbierta;
  }

  registrarAvance(): void {
    const rescateId = this.rescate?.rescate_id;
    if (!rescateId || this.registrandoAvance) return;

    if (!this.avance.estado) {
      this.errorAvance = 'Selecciona el nuevo estado del rescate.';
      return;
    }

    this.registrandoAvance = true;
    this.avanceOk = false;
    this.errorAvance = null;

    this.reportService
      .actualizarEstadoRescate(rescateId, this.avance.estado, this.avance.nota)
      .subscribe({
        next: () => {
          this.registrandoAvance = false;
          this.avanceOk = true;
          this.avance = { estado: '', nota: '' };
          this.cargarCaso(); // refresca historial
        },
        error: () => {
          this.registrandoAvance = false;
          this.errorAvance = 'No se pudo registrar el avance. Intenta de nuevo.';
        },
      });
  }

  // ─────────────────────────────────────────
  // Utilidades
  // ─────────────────────────────────────────

  get titulo(): string {
    const i = this.rescate?.incidencia;
    return i?.nombre_caso?.trim() || `${i?.tipo_animal ?? 'Animal'} en incidencia`;
  }

  imagenUrl(imagen: string | null | undefined): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }

  estadoLegible(estado: string): string {
    switch (estado) {
      case 'EN_CAMINO':  return 'En camino';
      case 'EN_SITIO':   return 'En sitio';
      case 'COMPLETADO': return 'Rescatado';
      case 'CANCELADO':  return 'Cancelado';
      default:           return estado;
    }
  }

  // Traduce el value del select a etiqueta bonita para guardar en caracteristicas
  private etiqueta(campo: string, val: string): string {
    const mapas: Record<string, Record<string, string>> = {
      sexo:         { macho: 'Macho', hembra: 'Hembra', indeterminado: 'No determinado' },
      esterilizado: { si: 'Sí', no: 'No', desconocido: 'Desconocido' },
      salud:        { estable: 'Estable', delicado: 'Delicado', critico: 'Crítico' },
      temperamento: { docil: 'Dócil', asustadizo: 'Asustadizo', agresivo: 'Agresivo', no_evaluable: 'No evaluable' },
    };
    return mapas[campo]?.[val] ?? val;
  }

  volver(): void {
    this.router.navigate(['/accepted-cases']);
    }
    get puedeCerrar(): boolean {
    return this.rescate?.estado === 'EN_SITIO';
  }
  get yaCerrado(): boolean {
    return this.rescate?.estado === 'COMPLETADO';
  }
  onFotoSeleccionada(event: Event): void {
  const input = event.target as HTMLInputElement;
  const archivo = input.files?.[0] ?? null;
  this.foto = archivo;
  this.fotoPreview = archivo ? URL.createObjectURL(archivo) : null;
}

cerrarCaso(): void {
  const rescateId = this.rescate?.rescate_id;
  if (!rescateId || this.cerrando) return;

  if (!this.foto) {
    this.errorCierre = 'Sube una foto del animal asegurado para cerrar el caso.';
    return;
  }
  if (!navigator.geolocation) {
    this.errorCierre = 'Tu navegador no permite obtener la ubicación.';
    return;
  }

  this.cerrando = true;
  this.errorCierre = null;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      this.reportService
        .cerrarRescate(rescateId, pos.coords.latitude, pos.coords.longitude, this.foto!)
        .subscribe({
          next: () => {
            this.cerrando = false;
            this.router.navigate(['/case-accepted-success'], {
              queryParams: { folio: this.rescate?.incidencia?.folio, cerrado: '1' },
            });
          },
          error: (err) => {
            this.cerrando = false;
            this.errorCierre = err?.error?.code === 'gps_too_far'
              ? 'Debes estar a menos de 100 m del punto reportado para cerrar el caso.'
              : 'No se pudo cerrar el caso. Verifica la foto y tu ubicación.';
          },
        });
    },
    () => {
      this.cerrando = false;
      this.errorCierre = 'No pudimos obtener tu ubicación. Activa el GPS y permite el acceso.';
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}
}