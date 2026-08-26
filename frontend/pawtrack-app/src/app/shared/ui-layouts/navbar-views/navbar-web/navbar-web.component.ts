import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuToggleComponent } from '../../menu-toggle/menu-toggle.component';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from 'src/environments/environment';
import { CampanaNotificacionesComponent } from '../../campana-notificaciones/campana-notificaciones.component';

@Component({
  selector: 'app-navbar-web',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MenuToggleComponent, CampanaNotificacionesComponent],
  templateUrl: './navbar-web.component.html',
  styleUrls: ['./navbar-web.component.scss']
})
export class NavbarWebComponent {

  private auth = inject(AuthService);

  usuario$ = this.auth.user$;

  isHidden = false;
  private lastScrollTop = 0;

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScroll = window.scrollY;

    if (currentScroll > this.lastScrollTop && currentScroll > 120) {
      this.isHidden = true;
    } else {
      this.isHidden = false;
    }

    this.lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
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
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${foto}`;
  }
}