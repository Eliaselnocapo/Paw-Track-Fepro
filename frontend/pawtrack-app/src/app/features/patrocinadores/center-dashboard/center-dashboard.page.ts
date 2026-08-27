import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { forkJoin } from 'rxjs';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { SolicitudCentroApoyo, TipoCentro, FormaAyuda, RedesSociales } from '../../../core/models/centro-animal.model';
import { CentrosAnimalesService, PublicacionCentro as PublicacionCentroApi, ResenaCentro as ResenaCentroApi, SeguidorCentro as SeguidorCentroApi } from '../../../core/services/centros-animales.service';
import { ToastService } from '../../../core/services/toast.service';
import { RevealDirective } from 'src/app/shared/directives/reveal.directive';
// ── Interfaces "de vista" — mismo shape que usaba el mock ──

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

interface SeguidorCentro {
  id: number;
  nombre: string;
  fotoUrl?: string;
  desde: string;
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
  seguidoresLista: SeguidorCentro[];
}

/**
 * Panel de ADMINISTRACIÓN del centro — vista privada. El backend ya
 * filtra por dueño (misSolicitudesCentro filtra por request.user, y
 * cada endpoint de edición/publicación valida propiedad server-side).
 */
@Component({
  selector: 'app-center-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, NavbarWebComponent, FooterWebComponent, RevealDirective],
  templateUrl: './center-dashboard.page.html',
  styleUrls: ['./center-dashboard.page.scss'],
})
export class CenterDashboardPage implements OnInit {

   @ViewChild(IonContent) ionContent!: IonContent;

  cargando = true;
  error: string | null = null;
  perfil: PerfilCentroCompleto | null = null;
  subiendoBanner = false;
  subiendoLogo = false;

  private centroIdNumerico: number | null = null;

  constructor(
    private router: Router,
    private centrosAnimalesService: CentrosAnimalesService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    this.cargando = true;
    this.error = null;

    this.centrosAnimalesService.misSolicitudesCentro().subscribe({
      next: (solicitudes) => {
        const miCentro = solicitudes[0]; // OneToOne: solo puede tener uno

        if (!miCentro) {
          this.error = 'Todavía no has registrado un centro de apoyo.';
          this.cargando = false;
          return;
        }

        if (miCentro.estado !== 'APROBADO') {
          this.error = `Tu solicitud está en estado "${miCentro.estado}". El panel se habilita cuando se apruebe.`;
          this.cargando = false;
          return;
        }

        this.centroIdNumerico = miCentro.id;
        this.cargarDatosCompletos(miCentro);
      },
      error: () => {
        this.error = 'No se pudo cargar la información de tu centro.';
        this.cargando = false;
      },
    });
  }


  private cargarDatosCompletos(centro: SolicitudCentroApoyo): void {
    if (this.centroIdNumerico === null) return;

    forkJoin({
      publicaciones: this.centrosAnimalesService.listarPublicaciones(this.centroIdNumerico),
      resenas: this.centrosAnimalesService.listarResenas(this.centroIdNumerico),
      seguidores: this.centrosAnimalesService.listarSeguidores(this.centroIdNumerico),
    }).subscribe({
      next: ({ publicaciones, resenas, seguidores }) => {
        const publicacionesVM = publicaciones.map((p) => this.mapearPublicacion(p));
        const resenasVM = resenas.map((r) => this.mapearResena(r));
        const seguidoresVM = seguidores.map((s) => this.mapearSeguidor(s));

        this.perfil = {
          centro,
          estadisticas: {
            seguidores: seguidoresVM.length,
            totalPublicaciones: publicacionesVM.length,
            calificacionPromedio: this.calcularPromedio(resenasVM),
            totalResenas: resenasVM.length,
          },
          publicaciones: publicacionesVM,
          resenas: resenasVM,
          seguidoresLista: seguidoresVM,
        };
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la información de tu centro.';
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

  private mapearSeguidor(s: SeguidorCentroApi): SeguidorCentro {
    const nombre = `${s.usuario.firstName} ${s.usuario.lastName}`.trim();
    return {
      id: s.id,
      nombre: nombre || 'Usuario de PawTrack',
      fotoUrl: s.usuario.fotoPerfil ?? undefined,
      desde: s.createdAt,
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

  // ─────────────────────────────────────────
  // EDITAR PERFIL
  // ─────────────────────────────────────────

  editando = false;

  formNombre = '';
  formTipo: TipoCentro = 'veterinaria';
  formTelefono = '';
  formHorario = '';
  formSitioWeb = '';
  formDescripcion = '';
  formMision = '';
  formVision = '';
  formFormasAyuda: FormaAyuda[] = [];
  formRedesSociales: RedesSociales = {};

  formBannerArchivo: File | null = null;
  formBannerPreview: string | null = null;
  formLogoArchivo: File | null = null;
  formLogoPreview: string | null = null;

  guardandoEdicion = false;
  errorEdicion: string | null = null;

  readonly formasAyudaDisponibles: { valor: FormaAyuda; etiqueta: string; icono: string }[] = [
    { valor: 'dinero', etiqueta: 'Donaciones en dinero', icono: 'payments' },
    { valor: 'comida', etiqueta: 'Comida para animales', icono: 'pet_supplies' },
    { valor: 'viveres', etiqueta: 'Víveres / insumos', icono: 'inventory_2' },
    { valor: 'voluntariado', etiqueta: 'Voluntariado', icono: 'volunteer_activism' },
    { valor: 'adopciones', etiqueta: 'Adopciones', icono: 'pets' },
  ];

  activarEdicion(): void {
    if (!this.centro) return;

    this.formNombre = this.centro.nombre;
    this.formTipo = this.centro.tipo;
    this.formTelefono = this.centro.telefono;
    this.formHorario = this.centro.horario ?? '';
    this.formSitioWeb = this.centro.sitioWeb ?? '';
    this.formDescripcion = this.centro.descripcion ?? '';
    this.formMision = this.centro.mision ?? '';
    this.formVision = this.centro.vision ?? '';
    this.formFormasAyuda = [...(this.centro.formasAyuda ?? [])];
    this.formRedesSociales = { ...(this.centro.redesSociales ?? {}) };
    this.formBannerPreview = this.centro.bannerUrl ?? null;
    this.formLogoPreview = this.centro.logoUrl ?? null;
    this.formBannerArchivo = null;
    this.formLogoArchivo = null;

    this.errorEdicion = null;
    this.editando = true;

    this.ionContent?.scrollToTop(300);
  }

  cancelarEdicion(): void {
    this.editando = false;
    this.ionContent?.scrollToTop(300);
  }

  toggleFormaAyuda(valor: FormaAyuda): void {
    const idx = this.formFormasAyuda.indexOf(valor);
    if (idx > -1) this.formFormasAyuda.splice(idx, 1);
    else this.formFormasAyuda.push(valor);
  }

  tieneFormaAyuda(valor: FormaAyuda): boolean {
    return this.formFormasAyuda.includes(valor);
  }

  onBannerSeleccionado(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.formBannerArchivo = file;
    this.formBannerPreview = URL.createObjectURL(file);
  }

  onLogoSeleccionado(event: Event): void {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.formLogoArchivo = file;
      this.formLogoPreview = URL.createObjectURL(file);
    }
    onBannerClickDirecto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || this.centroIdNumerico === null) return;

    this.subiendoBanner = true;
    this.centrosAnimalesService.editarCentro(this.centroIdNumerico, { banner: file }).subscribe({
      next: (centroActualizado) => {
        if (this.perfil) this.perfil.centro = centroActualizado;
        this.subiendoBanner = false;
        this.toastService.mostrar('Portada actualizada.', 'exito');
      },
      error: () => {
        this.subiendoBanner = false;
        this.toastService.mostrar('No se pudo actualizar la portada.', 'error');
      },
    });
}

  onLogoClickDirecto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || this.centroIdNumerico === null) return;

    this.subiendoLogo = true;
    this.centrosAnimalesService.editarCentro(this.centroIdNumerico, { logo: file }).subscribe({
      next: (centroActualizado) => {
        if (this.perfil) this.perfil.centro = centroActualizado;
        this.subiendoLogo = false;
        this.toastService.mostrar('Logo actualizado.', 'exito');
      },
      error: () => {
        this.subiendoLogo = false;
        this.toastService.mostrar('No se pudo actualizar el logo.', 'error');
      },
    });
  }

  guardarEdicion(): void {
    if (this.formNombre.trim().length < 3) {
      this.errorEdicion = 'El nombre debe tener al menos 3 caracteres.';
      return;
    }
    if (!this.perfil || !this.centro || this.guardandoEdicion || this.centroIdNumerico === null) return;

    this.guardandoEdicion = true;
    this.errorEdicion = null;

    this.centrosAnimalesService
      .editarCentro(this.centroIdNumerico, {
        nombre: this.formNombre.trim(),
        tipo: this.formTipo,
        telefono: this.formTelefono.trim(),
        horario: this.formHorario.trim(),
        sitioWeb: this.formSitioWeb.trim(),
        descripcion: this.formDescripcion.trim(),
        mision: this.formMision.trim(),
        vision: this.formVision.trim(),
        formasAyuda: this.formFormasAyuda,
        redesSociales: this.formRedesSociales,
        banner: this.formBannerArchivo,
        logo: this.formLogoArchivo,
      })
      .subscribe({
        next: (centroActualizado) => {
          if (this.perfil) this.perfil.centro = centroActualizado;
          this.guardandoEdicion = false;
          this.editando = false;
          this.toastService.mostrar('Cambios guardados correctamente.', 'exito');
        },
        error: () => {
          this.guardandoEdicion = false;
          this.errorEdicion = 'No se pudo guardar el cambio. Intenta de nuevo.';
        },
      });
  }

  // ─────────────────────────────────────────
  // PUBLICAR
  // ─────────────────────────────────────────

  mostrarFormularioPost = false;
  textoNuevoPost = '';
  fotoPostArchivo: File | null = null;
  fotoPostPreview: string | null = null;
  enviandoPost = false;
  errorPost: string | null = null;

  editandoPostId: number | null = null;

  abrirFormularioPost(): void {
    this.mostrarFormularioPost = true;
    this.editandoPostId = null;
    this.textoNuevoPost = '';
    this.fotoPostArchivo = null;
    this.fotoPostPreview = null;
    this.errorPost = null;
  }

  editarPost(post: { id: number; texto: string; imagenUrl?: string }): void {
    this.mostrarFormularioPost = true;
    this.editandoPostId = post.id;
    this.textoNuevoPost = post.texto;
    this.fotoPostArchivo = null;
    this.fotoPostPreview = post.imagenUrl ?? null;
    this.errorPost = null;
  }

  cancelarPost(): void {
    this.mostrarFormularioPost = false;
    this.editandoPostId = null;
    if (this.fotoPostPreview) URL.revokeObjectURL(this.fotoPostPreview);
    this.fotoPostPreview = null;
  }

  onFotoPostSeleccionada(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.fotoPostArchivo = file;
    this.fotoPostPreview = URL.createObjectURL(file);
  }

  quitarFotoPost(): void {
    if (this.fotoPostPreview) URL.revokeObjectURL(this.fotoPostPreview);
    this.fotoPostArchivo = null;
    this.fotoPostPreview = null;
  }

  publicarPost(): void {
    if (this.textoNuevoPost.trim().length < 5) {
      this.errorPost = 'Escribe al menos unas palabras antes de publicar.';
      return;
    }
    if (!this.perfil || this.enviandoPost || this.centroIdNumerico === null) return;

    this.enviandoPost = true;
    this.errorPost = null;

    if (this.editandoPostId !== null) {
      this.centrosAnimalesService
        .editarPublicacion(this.centroIdNumerico, this.editandoPostId, this.textoNuevoPost.trim(), this.fotoPostArchivo ?? undefined)
        .subscribe({
          next: (actualizado) => {
            this.enviandoPost = false;
            this.mostrarFormularioPost = false;

            if (!this.perfil) return;

            const post = this.perfil.publicaciones.find((p) => p.id === actualizado.id);
            if (post) {
              post.texto = actualizado.contenido;
              post.imagenUrl = actualizado.imagenUrl ?? undefined;
            }
          },
          error: () => {
            this.enviandoPost = false;
            this.errorPost = 'No se pudo guardar el cambio. Intenta de nuevo.';
          },
        });
      return;
    }

    this.centrosAnimalesService
      .crearPublicacion(this.centroIdNumerico, this.textoNuevoPost.trim(), this.fotoPostArchivo ?? undefined)
      .subscribe({
        next: (nuevoPostApi) => {
          this.enviandoPost = false;
          this.mostrarFormularioPost = false;

          if (!this.perfil) return;

          this.perfil.publicaciones = [this.mapearPublicacion(nuevoPostApi), ...this.perfil.publicaciones];
          this.perfil.estadisticas.totalPublicaciones++;
        },
        error: () => {
          this.enviandoPost = false;
          this.errorPost = 'No se pudo publicar. Intenta de nuevo.';
        },
      });
  }

  eliminarPost(id: number): void {
    if (!this.perfil || this.centroIdNumerico === null) return;

    this.centrosAnimalesService.eliminarPublicacion(this.centroIdNumerico, id).subscribe({
      next: () => {
        if (!this.perfil) return;
        this.perfil.publicaciones = this.perfil.publicaciones.filter((p) => p.id !== id);
        this.perfil.estadisticas.totalPublicaciones = Math.max(0, this.perfil.estadisticas.totalPublicaciones - 1);
      },
    });
  }

  // ─────────────────────────────────────────
  // VER SEGUIDORES
  // ─────────────────────────────────────────

  mostrarSeguidores = false;

  get seguidores(): SeguidorCentro[] {
    return this.perfil?.seguidoresLista ?? [];
  }

  abrirSeguidores(): void {
    this.mostrarSeguidores = true;
  }

  cerrarSeguidores(): void {
    this.mostrarSeguidores = false;
  }

  // ─────────────────────────────────────────
  // RESPONDER RESEÑA
  // ─────────────────────────────────────────

  respondiendoResenaId: number | null = null;
  textoRespuesta = '';
  enviandoRespuesta = false;
  errorRespuesta: string | null = null;

  abrirRespuesta(resenaId: number): void {
    this.respondiendoResenaId = resenaId;
    this.textoRespuesta = '';
    this.errorRespuesta = null;
  }

  cancelarRespuesta(): void {
    this.respondiendoResenaId = null;
  }

  enviarRespuesta(resenaId: number): void {
    if (this.textoRespuesta.trim().length < 3) {
      this.errorRespuesta = 'Escribe una respuesta antes de enviar.';
      return;
    }
    if (!this.perfil || this.enviandoRespuesta || this.centroIdNumerico === null) return;

    this.enviandoRespuesta = true;
    this.errorRespuesta = null;

    this.centrosAnimalesService.responderResena(this.centroIdNumerico, resenaId, this.textoRespuesta.trim()).subscribe({
      next: (resenaActualizada) => {
        this.enviandoRespuesta = false;
        this.respondiendoResenaId = null;

        if (!this.perfil) return;

        const resena = this.perfil.resenas.find((r) => r.id === resenaId);
        if (resena) resena.respuestaCentro = resenaActualizada.respuesta ?? undefined;
      },
      error: () => {
        this.enviandoRespuesta = false;
        this.errorRespuesta = 'No se pudo enviar tu respuesta. Intenta de nuevo.';
      },
    });
  }

  volver(): void {
    this.router.navigate(['/patrocinadores']);
  }
}