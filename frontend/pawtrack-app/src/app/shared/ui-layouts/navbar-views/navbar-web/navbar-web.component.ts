import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuToggleComponent } from '../../menu-toggle/menu-toggle.component'; 
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-navbar-web',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MenuToggleComponent],
  templateUrl: './navbar-web.component.html',
  styleUrls: ['./navbar-web.component.scss']
  
})

export class NavbarWebComponent {
  
  private authService = inject(AuthService);

  // El getter ahora le pregunta directamente a tu excelente servicio
  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn(); 
  }
  constructor(private auth: AuthService) {}

  // getters:
  get iniciales(): string {
    const u = this.auth.getCurrentUser();
    if (!u) return '?';
    const n = (u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? '');
    return n.toUpperCase() || u.email?.[0]?.toUpperCase() || '?';
  }

}
