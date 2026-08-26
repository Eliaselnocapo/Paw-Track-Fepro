import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ProfileService, UsuarioResponse } from '../../../core/services/profile.service';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { RevealDirective } from 'src/app/shared/directives/reveal.directive';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
  ],
  templateUrl: './edit-profile.page.html',
  styleUrls: ['./edit-profile.page.scss'],
})
export class EditProfilePage implements OnInit {

  cargando = true;
  errorCarga: string | null = null;

  // ── Formulario ────────────────────────────
  form = {
    first_name: '',
    last_name:  '',
    telefono:   '',
    ubicacion:  '',
  };

  email = '';           // solo lectura (es el login)
  fotoActualUrl = '';   // foto que ya tiene el usuario

  foto: File | null = null;
  fotoPreview: string | null = null;

  guardando = false;
  guardadoOk = false;
  errorGuardar: string | null = null;

  constructor(
    private router: Router,
    private profileService: ProfileService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  // ─────────────────────────────────────────
  // Carga de datos actuales
  // ─────────────────────────────────────────

  private getUserIdFromToken(): number | null {
    const token = localStorage.getItem('pawtrack_access');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id ?? null;
    } catch { return null; }
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = null;

    const userId = this.getUserIdFromToken();
    if (!userId) {
      this.errorCarga = 'Debes iniciar sesión para editar tu perfil.';
      this.cargando = false;
      return;
    }

    this.profileService.obtenerUsuario(userId).subscribe({
      next: (u) => {
        this.precargar(u);
        this.cargando = false;
      },
      error: () => {
        this.errorCarga = 'No se pudo cargar tu perfil. Intenta de nuevo más tarde.';
        this.cargando = false;
      },
    });
  }

  private precargar(u: UsuarioResponse): void {
    this.form.first_name = u.first_name || '';
    this.form.last_name  = u.last_name  || '';
    // telefono y ubicacion pueden no existir aún en el modelo: acceso defensivo.
    this.form.telefono   = (u as any).telefono || '';
    this.form.ubicacion  = (u as any).ubicacion || u.perfil_patrocinador?.ubicacion || '';
    this.email           = u.email || '';
    this.fotoActualUrl   = this.resolverUrlMedia(u.foto_perfil, u.username || 'Usuario');
  }

  private resolverUrlMedia(url: string | null | undefined, nombreFallback: string): string {
    if (!url) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreFallback)}&background=1d4ed8&color=fff`;
    }
    return url.startsWith('http') ? url : `${environment.apiUrl}${url}`;
  }

  // ─────────────────────────────────────────
  // Foto
  // ─────────────────────────────────────────

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.foto = archivo;
    this.fotoPreview = archivo ? URL.createObjectURL(archivo) : null;
  }

  get avatarMostrado(): string {
    return this.fotoPreview || this.fotoActualUrl;
  }

  // ─────────────────────────────────────────
  // Guardar
  // ─────────────────────────────────────────

  guardar(): void {
    if (this.guardando) return;

    this.guardando = true;
    this.guardadoOk = false;
    this.errorGuardar = null;

    // Multipart para poder mandar la foto. El back saca el usuario del token,
    // así que NO enviamos id. email/password/rol NO se mandan (no editables).
    const datos = new FormData();
    datos.append('first_name', this.form.first_name.trim());
    datos.append('last_name',  this.form.last_name.trim());
    datos.append('telefono',   this.form.telefono.trim());
    datos.append('ubicacion',  this.form.ubicacion.trim());
    if (this.foto) datos.append('foto_perfil', this.foto, this.foto.name);

    this.profileService.actualizarPerfil(datos).subscribe({
      next: (usuarioActualizado: any) => {
        this.guardando = false;
        this.guardadoOk = true;
        // Refresca el usuario en sesión → el navbar ve la foto nueva al instante.
        this.auth.setCurrentUser(usuarioActualizado);
        setTimeout(() => this.router.navigate(['/profile']), 700);
      },
      error: (err) => {
        this.guardando = false;
        this.errorGuardar = err?.status === 404
          ? 'El servicio de edición de perfil aún no está disponible. Vuelve a intentar más tarde.'
          : 'No se pudieron guardar los cambios. Revisa los datos e intenta de nuevo.';
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/profile']);
  }
}