import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink  } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, RescateResponse, EntradaHistorial } from '../../../../core/services/report.service';
import { environment } from 'src/environments/environment';

import { CentrosAnimalesService } from '../../../../core/services/centros-animales.service';
import { CentroAnimal } from '../../../../core/models/centro-animal.model';

type EstadoAvance = '' | 'EN_SITIO' | 'COMPLETADO' | 'CANCELADO';

@Component({
  selector: 'app-update-case',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    RouterLink,
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
    color: '',
    raza: '',
    notas: '',
  };

  guardandoFicha = false;
  fichaOk = false;
  errorFicha: string | null = null;

  // ── Bitácora: centro de mando único ───────────────────────
  // El select decide qué formulario se muestra y a qué endpoint se llama:
  //   EN_SITIO   → PATCH /rescates/{id}/estado/   (solo nota)
  //   COMPLETADO → POST  /rescates/{id}/cerrar/   (foto + GPS)
  //   CANCELADO  → POST  /rescates/{id}/cancelar/ (motivo obligatorio)
  bitacoraAbierta = true;

  avance = {
    estado: '' as EstadoAvance,
    nota: '',
  };

  // Cierre (solo aplica si estado === COMPLETADO)
  foto: File | null = null;
  fotoPreview: string | null = null;
  centrosCercanos: CentroAnimal[] = [];
  cargandoCentrosCercanos = false;
  private centrosYaConsultados = false;

  // Cancelación (solo aplica si estado === CANCELADO)
  motivoCancelacion = '';

  procesando = false;         // cubre avance, cierre y cancelación
  avanceOk = false;
  errorAvance: string | null = null;

  // Confirmación para acciones definitivas
  modalConfirmarAbierto = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
    private centrosService: CentrosAnimalesService, // <-- NUEVO
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

    // Color, raza y temperamento ya tienen columna propia: el voluntario
    // confirma o corrige lo que capturo el reportante.
    this.ficha.color        = (i['color_animal'] as string) || '';
    this.ficha.raza         = (i['raza_animal'] as string) || '';
    this.ficha.temperamento = (i['agresividad_animal'] as string) || '';
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

  // Los campos sin columna propia se guardan concatenados en "ficha_voluntario".
    const extras: string[] = [];
    if (this.ficha.sexo)         extras.push(`Sexo: ${this.etiqueta('sexo', this.ficha.sexo)}`);
    if (this.ficha.esterilizado) extras.push(`Esterilizado: ${this.etiqueta('esterilizado', this.ficha.esterilizado)}`);
    if (this.ficha.salud)        extras.push(`Salud: ${this.etiqueta('salud', this.ficha.salud)}`);
    if (this.ficha.notas.trim()) extras.push(`Notas clínicas: ${this.ficha.notas.trim()}`);

    this.reportService.actualizarReporte(incidenciaId, {
      peso_estimado:      this.ficha.peso || undefined,
      edad_estimada:      this.ficha.edad || undefined,
      color_animal:       this.ficha.color.trim() || undefined,
      raza_animal:        this.ficha.raza.trim()  || undefined,
      agresividad_animal: this.ficha.temperamento || undefined,
      ficha_voluntario:   extras.length ? extras.join(' | ') : undefined,
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
  // Getters de la bitácora
  // ─────────────────────────────────────────

  get especie(): string { return this.rescate?.incidencia?.tipo_animal || 'No especificado'; }
  get tamano(): string { return this.rescate?.incidencia?.['tamano_animal'] || 'No especificado'; }
  get condicion(): string { return this.rescate?.incidencia?.['condicion_animal'] || 'No especificada'; }
  get score(): number { return Math.round(this.rescate?.incidencia?.urgency_score ?? 0); }
  get contactoNombre(): string { return this.rescate?.incidencia?.nombre_contacto || 'No registrado'; }
  get contactoTelefono(): string { return this.rescate?.incidencia?.telefono_contacto || 'No registrado'; }
  get historial(): EntradaHistorial[] { return this.rescate?.historial ?? []; }

  get esCierre(): boolean     { return this.avance.estado === 'COMPLETADO'; }
  get esCancelacion(): boolean { return this.avance.estado === 'CANCELADO'; }
  get esDefinitivo(): boolean  { return this.esCierre || this.esCancelacion; }

  // El caso ya terminó: no se puede registrar nada más.
  get casoTerminado(): boolean {
    return this.rescate?.estado === 'COMPLETADO' || this.rescate?.estado === 'CANCELADO';
  }

  get yaCerrado(): boolean   { return this.rescate?.estado === 'COMPLETADO'; }
  get yaCancelado(): boolean { return this.rescate?.estado === 'CANCELADO'; }

  // Texto y color del botón según lo que se eligió
  get textoBoton(): string {
    if (this.esCierre)      return 'Cerrar caso como rescatado';
    if (this.esCancelacion) return 'Cancelar rescate';
    return 'Registrar avance';
  }

  get claseBoton(): string {
    if (this.esCierre)      return 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/30';
    if (this.esCancelacion) return 'bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-red-600/30';
    return 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-600/30';
  }

  toggleBitacora(): void {
    this.bitacoraAbierta = !this.bitacoraAbierta;
  }

  // Al cambiar de estado limpiamos lo que no aplica, para no mandar basura.
  onCambioEstado(): void {
    this.errorAvance = null;
    this.avanceOk = false;
 
    if (!this.esCierre) {
      this.foto = null;
      this.fotoPreview = null;
    }
    if (!this.esCancelacion) {
      this.motivoCancelacion = '';
    }
 
    if (this.esCierre) {
      this.cargarCentrosCercanos();
    }
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.foto = archivo;
    this.fotoPreview = archivo ? URL.createObjectURL(archivo) : null;
  }

  private cargarCentrosCercanos(): void {
    if (this.centrosYaConsultados) return;
 
    if (!navigator.geolocation) {
      return; // sin soporte de geolocalización, simplemente no mostramos la sugerencia
    }
 
    this.centrosYaConsultados = true;
    this.cargandoCentrosCercanos = true;
 
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.centrosService
          .buscarTodosLosCentros(
            { latitud: pos.coords.latitude, longitud: pos.coords.longitude },
            10
          )
          .subscribe({
            next: (centros) => {
              this.centrosCercanos = centros.slice(0, 3);
              this.cargandoCentrosCercanos = false;
            },
            error: () => {
              this.cargandoCentrosCercanos = false;
            },
          });
      },
      () => {
        // El usuario no dio permiso de ubicación, o falló el GPS.
        // No es un error grave — simplemente no mostramos la sugerencia,
        // el flujo de cerrar el caso sigue funcionando normal.
        this.cargandoCentrosCercanos = false;
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // ─────────────────────────────────────────
  // Envío: valida, confirma si es definitivo, y despacha al endpoint correcto
  // ─────────────────────────────────────────

  enviar(): void {
    if (this.procesando) return;
    if (!this.validar()) return;

    // Cierre y cancelación son irreversibles → confirmamos primero.
    if (this.esDefinitivo) {
      this.modalConfirmarAbierto = true;
      return;
    }

    this.ejecutar();
  }

  private validar(): boolean {
    this.errorAvance = null;

    if (!this.avance.estado) {
      this.errorAvance = 'Selecciona el nuevo estado del rescate.';
      return false;
    }
    if (this.esCierre && !this.foto) {
      this.errorAvance = 'Sube una foto del animal asegurado para cerrar el caso.';
      return false;
    }
    if (this.esCancelacion && !this.motivoCancelacion.trim()) {
      this.errorAvance = 'Cuéntanos por qué cancelas el rescate.';
      return false;
    }
    return true;
  }

  cerrarModalConfirmar(): void {
    if (this.procesando) return;
    this.modalConfirmarAbierto = false;
  }

  confirmarAccion(): void {
    this.ejecutar();
  }

  private ejecutar(): void {
    const rescateId = this.rescate?.rescate_id;
    if (!rescateId) return;

    this.procesando = true;
    this.avanceOk = false;
    this.errorAvance = null;

    if (this.esCierre)          this.ejecutarCierre(rescateId);
    else if (this.esCancelacion) this.ejecutarCancelacion(rescateId);
    else                         this.ejecutarAvance(rescateId);
  }

  // EN_SITIO → PATCH estado
  private ejecutarAvance(rescateId: number): void {
    this.reportService
      .actualizarEstadoRescate(rescateId, this.avance.estado as 'EN_SITIO', this.avance.nota)
      .subscribe({
        next: () => {
          this.procesando = false;
          this.avanceOk = true;
          this.resetForm();
          this.cargarCaso(); // refresca historial
        },
        error: (err) => {
          this.procesando = false;
          this.errorAvance = err?.error?.detail || 'No se pudo registrar el avance. Intenta de nuevo.';
        },
      });
  }

  // COMPLETADO → POST cerrar (necesita foto + GPS actual)
  private ejecutarCierre(rescateId: number): void {
    if (!navigator.geolocation) {
      this.procesando = false;
      this.modalConfirmarAbierto = false;
      this.errorAvance = 'Tu navegador no permite obtener la ubicación.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.reportService
          .cerrarRescate(rescateId, pos.coords.latitude, pos.coords.longitude, this.foto!)
          .subscribe({
            next: () => {
              this.procesando = false;
              this.modalConfirmarAbierto = false;
              this.router.navigate(['/rescue-complete', this.rescate?.incidencia?.folio]);
            },
            error: (err) => {
              this.procesando = false;
              this.modalConfirmarAbierto = false;
              this.errorAvance = err?.error?.code === 'gps_too_far'
                ? 'Estás demasiado lejos del punto reportado para cerrar el caso.'
                : (err?.error?.detail || 'No se pudo cerrar el caso. Verifica la foto y tu ubicación.');
            },
          });
      },
      () => {
        this.procesando = false;
        this.modalConfirmarAbierto = false;
        this.errorAvance = 'No pudimos obtener tu ubicación. Activa el GPS y permite el acceso.';
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // CANCELADO → POST cancelar (el caso vuelve a estar disponible)
  private ejecutarCancelacion(rescateId: number): void {
    this.reportService
      .cancelarRescate(rescateId, this.motivoCancelacion)
      .subscribe({
        next: () => {
          this.procesando = false;
          this.modalConfirmarAbierto = false;
          this.router.navigate(['/accepted-cases']);
        },
        error: (err) => {
          this.procesando = false;
          this.modalConfirmarAbierto = false;
          this.errorAvance = err?.error?.detail || 'No se pudo cancelar el rescate. Intenta de nuevo.';
        },
      });
  }

  private resetForm(): void {
    this.avance = { estado: '', nota: '' };
    this.foto = null;
    this.fotoPreview = null;
    this.motivoCancelacion = '';
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

  // Traduce el value del select a etiqueta bonita para guardar en la ficha
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
}