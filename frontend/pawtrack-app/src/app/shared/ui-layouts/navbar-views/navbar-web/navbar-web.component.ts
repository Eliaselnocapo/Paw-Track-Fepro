import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuToggleComponent } from '../../menu-toggle/menu-toggle.component';

@Component({
  selector: 'app-navbar-web',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MenuToggleComponent], // Importante agregar RouterLinkActive
  templateUrl: './navbar-web.component.html',
  styleUrls: ['./navbar-web.component.scss']
})
export class NavbarWebComponent {
  // TODO: Esto cambiará dinámicamente cuando el login con el backend esté listo
  isLoggedIn: boolean = false;
}
