import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

// TODO backend: reemplazar por el servicio real cuando exista
// GET /api/centros-apoyo/{id}/perfil/
import { CentroApoyoMockService, PerfilCentroCompleto, ResenaCentro } from '../../../features/auth/register-center/center-support-mock.service';
import { SolicitudCentroApoyo } from '../../../core/models/centro-animal.model';

/**
 * Vista PÚBLICA del perfil de un centro — la ve cualquier usuario,
 * con o sin sesión, con o sin relación con el centro. Solo puede
 * leer, seguir, y dejar una reseña.
 *
 * Para administrar el centro (publicar, editar datos, ver estadísticas
 * a detalle) existe una vista APARTE: CenterDashboardPage — esa sí
 * requiere ser el dueño del centro. No se mezclan en un mismo
 * componente con un "if esDueño" — son responsabilidades distintas.
 */
@Component({
  selector: 'app-perfil-centro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, NavbarWebComponent, FooterWebComponent],
  templateUrl: './center-profile.page.html',
  styleUrls: ['./center-profile.page.scss'],
})
export class PerfilCentroPage implements OnInit {

  cargando = true;
  error: string | null = null;
  perfil: PerfilCentroCompleto | null = null;

  /** Mock local — Fase 4 (seguir) no tiene backend todavía. */
  siguiendoLocal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private centroApoyoMock: CentroApoyoMockService,
  ) {}

  ngOnInit(): void {
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error = 'No se encontró el centro solicitado.';
      this.cargando = false;
      return;
    }

    this.cargando = true;
    this.error = null;

    this.centroApoyoMock.obtenerPerfilMock(id).subscribe({
      next: (data) => {
        this.perfil = data;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el perfil de este centro.';
        this.cargando = false;
      },
    });
  }

  get centro(): SolicitudCentroApoyo | null {
    return this.perfil?.centro ?? null;
  }

  get tieneRedesSociales(): boolean {
    const redes = this.centro?.redesSociales;
    return !!(redes?.facebook || redes?.instagram || redes?.tiktok || redes?.whatsapp);
  }

  get tieneMisionOVision(): boolean {
    return !!(this.centro?.mision || this.centro?.vision);
  }

  readonly estrellasBase = [1, 2, 3, 4, 5];

  // ─────────────────────────────────────────
  // PAGINACIÓN DE RESEÑAS: se muestran 3 a la vez, con flechas y puntitos
  // ─────────────────────────────────────────

  readonly resenasPorPagina = 1; // 1 a la vez: vive en la sidebar angosta, no en la columna principal
  paginaResenaActual = 0;

  get resenasPaginadas(): ResenaCentro[] {
    if (!this.perfil) return [];
    const inicio = this.paginaResenaActual * this.resenasPorPagina;
    return this.perfil.resenas.slice(inicio, inicio + this.resenasPorPagina);
  }

  get totalPaginasResenas(): number {
    if (!this.perfil) return 0;
    return Math.ceil(this.perfil.resenas.length / this.resenasPorPagina);
  }

  get indicesPaginasResenas(): number[] {
    return Array.from({ length: this.totalPaginasResenas }, (_, i) => i);
  }

  get puedeAnteriorResena(): boolean {
    return this.paginaResenaActual > 0;
  }

  get puedeSiguienteResena(): boolean {
    return this.paginaResenaActual < this.totalPaginasResenas - 1;
  }

  anteriorPaginaResena(): void {
    if (this.puedeAnteriorResena) this.paginaResenaActual--;
  }

  siguientePaginaResena(): void {
    if (this.puedeSiguienteResena) this.paginaResenaActual++;
  }

  irAPaginaResena(pagina: number): void {
    this.paginaResenaActual = pagina;
  }

  // ─────────────────────────────────────────
  // MODAL: ver todas las reseñas a detalle (estilo Facebook)
  // ─────────────────────────────────────────

  mostrarModalResenas = false;

  abrirModalResenas(): void {
    this.mostrarModalResenas = true;
  }

  cerrarModalResenas(): void {
    this.mostrarModalResenas = false;
  }

  /** A partir de qué tan largo un comentario amerita mostrar "Ver más" en vez de todo el texto. */
  comentarioEsLargo(comentario: string): boolean {
    return comentario.length > 110;
  }

  toggleSeguir(): void {
    // TODO backend: POST /api/centros-apoyo/{id}/seguir/
    this.siguiendoLocal = !this.siguiendoLocal;
  }

  // ─────────────────────────────────────────
  // FORMULARIO: dejar una reseña (esto SÍ es del visitante, se queda aquí)
  // ─────────────────────────────────────────

  mostrarFormularioResena = false;
  calificacionSeleccionada = 0;
  calificacionHover = 0;
  comentarioResena = '';
  enviandoResena = false;
  errorResena: string | null = null;

  abrirFormularioResena(): void {
    this.mostrarFormularioResena = true;
    this.calificacionSeleccionada = 0;
    this.comentarioResena = '';
    this.errorResena = null;
  }

  cancelarResena(): void {
    this.mostrarFormularioResena = false;
  }

  seleccionarCalificacion(valor: number): void {
    this.calificacionSeleccionada = valor;
  }

  enviarResena(): void {
    if (this.calificacionSeleccionada === 0) {
      this.errorResena = 'Selecciona una calificación de 1 a 5 estrellas.';
      return;
    }
    if (!this.perfil || this.enviandoResena) return;

    this.enviandoResena = true;
    this.errorResena = null;

    const id = this.route.snapshot.paramMap.get('id') ?? '';

    this.centroApoyoMock
      .crearResenaMock(id, this.calificacionSeleccionada, this.comentarioResena.trim())
      .subscribe({
        next: (nuevaResena) => {
          this.enviandoResena = false;
          this.mostrarFormularioResena = false;

          if (!this.perfil) return;

          this.perfil.resenas = [nuevaResena, ...this.perfil.resenas];
          this.perfil.estadisticas.totalResenas++;

          const suma = this.perfil.resenas.reduce((acc, r) => acc + r.calificacion, 0);
          this.perfil.estadisticas.calificacionPromedio =
            Math.round((suma / this.perfil.resenas.length) * 10) / 10;
        },
        error: () => {
          this.enviandoResena = false;
          this.errorResena = 'No se pudo enviar tu reseña. Intenta de nuevo.';
        },
      });
  }

  volver(): void {
    this.router.navigate(['/patrocinadores']);
  }
}