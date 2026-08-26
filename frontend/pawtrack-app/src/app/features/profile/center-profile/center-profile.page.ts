import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { forkJoin } from 'rxjs';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { SolicitudCentroApoyo } from '../../../core/models/centro-animal.model';
import {
  CentrosAnimalesService,
  PublicacionCentro as PublicacionCentroApi,
  ResenaCentro as ResenaCentroApi,
} from '../../../core/services/centros-animales.service';

import { RevealDirective } from 'src/app/shared/directives/reveal.directive';

// ── Interfaces "de vista" — mismo shape que usaba el mock, para no
// tener que tocar el .html. Se llenan con datos reales mapeados. ──

interface PublicacionCentro {
  id: number;
  texto: string;
  fecha: string;
  imagenUrl?: string;
}

interface ResenaCentro {
  id: number;
  autorNombre: string;
  autorFotoUrl?: string;
  calificacion: number;
  comentario: string;
  fecha: string;
  respuestaCentro?: string;
}

interface EstadisticasCentro {
  seguidores: number;
  totalPublicaciones: number;
  calificacionPromedio: number;
  totalResenas: number;
}

interface PerfilCentroCompleto {
  centro: SolicitudCentroApoyo;
  estadisticas: EstadisticasCentro;
  publicaciones: PublicacionCentro[];
  resenas: ResenaCentro[];
}

/**
 * Vista PÚBLICA del perfil de un centro — la ve cualquier usuario,
 * con o sin sesión, con o sin relación con el centro. Solo puede
 * leer, seguir, y dejar una reseña.
 *
 * Para administrar el centro (publicar, editar datos, ver estadísticas
 * a detalle) existe una vista APARTE: CenterDashboardPage — esa sí
 * requiere ser el dueño del centro.
 */
@Component({
  selector: 'app-perfil-centro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, NavbarWebComponent, FooterWebComponent, RevealDirective],
  templateUrl: './center-profile.page.html',
  styleUrls: ['./center-profile.page.scss'],
})
export class PerfilCentroPage implements OnInit {

  cargando = true;
  error: string | null = null;
  perfil: PerfilCentroCompleto | null = null;

  private centroIdNumerico: number | null = null;

  siguiendoLocal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private centrosAnimalesService: CentrosAnimalesService,
  ) {}

  ngOnInit(): void {
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.error = 'No se encontró el centro solicitado.';
      this.cargando = false;
      return;
    }

    const idReal = idParam.replace('verificado-', '');
    if (!/^\d+$/.test(idReal)) {
      // Es un centro de OSM (no verificado), no tiene perfil propio en tu backend.
      this.error = 'Este refugio no tiene un perfil detallado disponible.';
      this.cargando = false;
      return;
    }

    this.centroIdNumerico = Number(idReal);
    this.cargando = true;
    this.error = null;

    forkJoin({
      centro: this.centrosAnimalesService.obtenerPerfilBasico(this.centroIdNumerico),
      publicaciones: this.centrosAnimalesService.listarPublicaciones(this.centroIdNumerico),
      resenas: this.centrosAnimalesService.listarResenas(this.centroIdNumerico),
      seguidores: this.centrosAnimalesService.listarSeguidores(this.centroIdNumerico),
    }).subscribe({
      next: ({ centro, publicaciones, resenas, seguidores }) => {
        const publicacionesVM = publicaciones.map((p) => this.mapearPublicacion(p));
        const resenasVM = resenas.map((r) => this.mapearResena(r));

        this.perfil = {
          centro,
          estadisticas: {
            seguidores: seguidores.length,
            totalPublicaciones: publicacionesVM.length,
            calificacionPromedio: this.calcularPromedio(resenasVM),
            totalResenas: resenasVM.length,
          },
          publicaciones: publicacionesVM,
          resenas: resenasVM,
        };
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el perfil de este centro.';
        this.cargando = false;
      },
    });
  }

  private mapearPublicacion(p: PublicacionCentroApi): PublicacionCentro {
    return {
      id: p.id,
      texto: p.contenido,
      fecha: p.createdAt,
      imagenUrl: p.imagenUrl ?? undefined,
    };
  }

  private mapearResena(r: ResenaCentroApi): ResenaCentro {
    const nombre = `${r.usuario.firstName} ${r.usuario.lastName}`.trim();
    return {
      id: r.id,
      autorNombre: nombre || 'Usuario de PawTrack',
      autorFotoUrl: r.usuario.fotoPerfil ?? undefined,
      calificacion: r.calificacion,
      comentario: r.comentario,
      fecha: r.createdAt,
      respuestaCentro: r.respuesta ?? undefined,
    };
  }

  private calcularPromedio(resenas: ResenaCentro[]): number {
    if (resenas.length === 0) return 0;
    const suma = resenas.reduce((acc, r) => acc + r.calificacion, 0);
    return Math.round((suma / resenas.length) * 10) / 10;
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
  // PAGINACIÓN DE RESEÑAS: se muestran 1 a la vez, con flechas y puntitos
  // ─────────────────────────────────────────

  readonly resenasPorPagina = 1;
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
  // MODAL: ver todas las reseñas a detalle
  // ─────────────────────────────────────────

  mostrarModalResenas = false;

  abrirModalResenas(): void {
    this.mostrarModalResenas = true;
  }

  cerrarModalResenas(): void {
    this.mostrarModalResenas = false;
  }

  comentarioEsLargo(comentario: string): boolean {
    return comentario.length > 110;
  }

  toggleSeguir(): void {
    if (this.centroIdNumerico === null) return;

    this.centrosAnimalesService.toggleSeguir(this.centroIdNumerico).subscribe({
      next: ({ siguiendo }) => {
        this.siguiendoLocal = siguiendo;
        if (this.perfil) {
          this.perfil.estadisticas.seguidores += siguiendo ? 1 : -1;
        }
      },
    });
  }

  // ─────────────────────────────────────────
  // FORMULARIO: dejar una reseña
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
    if (!this.perfil || this.enviandoResena || this.centroIdNumerico === null) return;

    this.enviandoResena = true;
    this.errorResena = null;

    this.centrosAnimalesService
      .crearResena(this.centroIdNumerico, this.calificacionSeleccionada, this.comentarioResena.trim())
      .subscribe({
        next: (nuevaResenaApi) => {
          this.enviandoResena = false;
          this.mostrarFormularioResena = false;

          if (!this.perfil) return;

          const nuevaResena = this.mapearResena(nuevaResenaApi);
          this.perfil.resenas = [nuevaResena, ...this.perfil.resenas];
          this.perfil.estadisticas.totalResenas++;
          this.perfil.estadisticas.calificacionPromedio = this.calcularPromedio(this.perfil.resenas);
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