import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { CentroApoyoMockService, PerfilCentroCompleto, SeguidorCentro } from '../../../features/auth/register-center/center-support-mock.service';
import { SolicitudCentroApoyo, TipoCentro, FormaAyuda, RedesSociales } from '../../../core/models/centro-animal.model';

/**
 * Panel de ADMINISTRACIÓN del centro — vista privada, distinta a
 * perfil-centro.page.ts (esa es pública). Aquí el dueño puede ver
 * estadísticas, publicar, y EDITAR toda su información de perfil.
 *
 * TODO backend/auth: falta un guard que verifique que request.user es
 * el dueño real de este centro.
 */
@Component({
  selector: 'app-center-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, NavbarWebComponent, FooterWebComponent],
  templateUrl: './center-dashboard.page.html',
  styleUrls: ['./center-dashboard.page.scss'],
})
export class CenterDashboardPage implements OnInit {

  cargando = true;
  error: string | null = null;
  perfil: PerfilCentroCompleto | null = null;

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
        this.error = 'No se pudo cargar la información de tu centro.';
        this.cargando = false;
      },
    });
  }

  get centro(): SolicitudCentroApoyo | null {
    return this.perfil?.centro ?? null;
  }

  // ─────────────────────────────────────────
  // EDITAR PERFIL
  // ─────────────────────────────────────────

  editando = false;

  // Campos del formulario de edición (copia editable, no se toca
  // "perfil.centro" directo hasta que se guarde).
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

    // Precarga el formulario con lo que ya existe.
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
  }

  cancelarEdicion(): void {
    this.editando = false;
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

  guardarEdicion(): void {
    if (this.formNombre.trim().length < 3) {
      this.errorEdicion = 'El nombre debe tener al menos 3 caracteres.';
      return;
    }
    if (!this.perfil || !this.centro || this.guardandoEdicion) return;

    this.guardandoEdicion = true;
    this.errorEdicion = null;

    // TODO backend: PATCH /api/centros-apoyo/{id}/ con FormData (igual
    // que el registro — hay banner/logo de por medio). Por ahora solo
    // actualizamos el objeto local para simular el guardado.
    setTimeout(() => {
      if (!this.perfil) return;

      this.perfil.centro = {
        ...this.perfil.centro,
        nombre: this.formNombre.trim(),
        tipo: this.formTipo,
        telefono: this.formTelefono.trim(),
        horario: this.formHorario.trim() || undefined,
        sitioWeb: this.formSitioWeb.trim() || undefined,
        descripcion: this.formDescripcion.trim() || undefined,
        mision: this.formMision.trim() || undefined,
        vision: this.formVision.trim() || undefined,
        formasAyuda: this.formFormasAyuda.length ? this.formFormasAyuda : undefined,
        redesSociales: this.formRedesSociales,
        bannerUrl: this.formBannerPreview ?? undefined,
        logoUrl: this.formLogoPreview ?? undefined,
      };

      this.guardandoEdicion = false;
      this.editando = false;
    }, 400);
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

  /** Si tiene valor, el formulario está en modo "editar" en vez de "crear nuevo". */
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
    if (!this.perfil || this.enviandoPost) return;

    this.enviandoPost = true;
    this.errorPost = null;

    const id = this.route.snapshot.paramMap.get('id') ?? '';

    if (this.editandoPostId !== null) {
      // TODO backend: cambiar por this.centrosApoyoService.editarPublicacion(...)
      this.centroApoyoMock
        .editarPublicacionMock(this.editandoPostId, this.textoNuevoPost.trim(), this.fotoPostPreview ?? undefined)
        .subscribe({
          next: (actualizado) => {
            this.enviandoPost = false;
            this.mostrarFormularioPost = false;

            if (!this.perfil) return;

            const post = this.perfil.publicaciones.find((p) => p.id === actualizado.id);
            if (post) {
              post.texto = actualizado.texto;
              post.imagenUrl = actualizado.imagenUrl;
            }
          },
          error: () => {
            this.enviandoPost = false;
            this.errorPost = 'No se pudo guardar el cambio. Intenta de nuevo.';
          },
        });
      return;
    }

    // TODO backend: cambiar por this.centrosApoyoService.crearPublicacion(...)
    this.centroApoyoMock
      .crearPublicacionMock(id, this.textoNuevoPost.trim(), this.fotoPostPreview ?? undefined)
      .subscribe({
        next: (nuevoPost) => {
          this.enviandoPost = false;
          this.mostrarFormularioPost = false;

          if (!this.perfil) return;

          this.perfil.publicaciones = [nuevoPost, ...this.perfil.publicaciones];
          this.perfil.estadisticas.totalPublicaciones++;
        },
        error: () => {
          this.enviandoPost = false;
          this.errorPost = 'No se pudo publicar. Intenta de nuevo.';
        },
      });
  }

  eliminarPost(id: number): void {
    // TODO backend: DELETE /api/centros-apoyo/{centroId}/publicaciones/{id}/
    if (!this.perfil) return;
    this.perfil.publicaciones = this.perfil.publicaciones.filter((p) => p.id !== id);
    this.perfil.estadisticas.totalPublicaciones = Math.max(0, this.perfil.estadisticas.totalPublicaciones - 1);
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
    if (!this.perfil || this.enviandoRespuesta) return;

    this.enviandoRespuesta = true;
    this.errorRespuesta = null;

    // TODO backend: cambiar por this.centrosApoyoService.responderResena(...)
    this.centroApoyoMock.responderResenaMock(resenaId, this.textoRespuesta.trim()).subscribe({
      next: ({ respuesta }) => {
        this.enviandoRespuesta = false;
        this.respondiendoResenaId = null;

        if (!this.perfil) return;

        const resena = this.perfil.resenas.find((r) => r.id === resenaId);
        if (resena) resena.respuestaCentro = respuesta;
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