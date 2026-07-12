import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuToggleComponent } from '../../menu-toggle/menu-toggle.component';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-navbar-web',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MenuToggleComponent],
  templateUrl: './navbar-web.component.html',
  styleUrls: ['./navbar-web.component.scss']
})
export class NavbarWebComponent {

  private auth = inject(AuthService);

  // El usuario como observable: si edita su perfil, el avatar se actualiza solo.
  usuario$ = this.auth.user$;

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  iniciales(u: any): string {
    if (!u) return '?';
    const n = (u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? '');
    return n.toUpperCase() || u.email?.[0]?.toUpperCase() || '?';
  }

  fotoUrl(u: any): string | null {
    const foto = u?.foto_perfil;
    if (!foto) return null;
    if (foto.startsWith('http')) return foto;
    // Las imágenes se sirven desde /media/, NO bajo /api/
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${foto}`;
  }
}