import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { RouterLink } from '@angular/router';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';

@Component({
  selector: 'app-view-web',
  standalone: true,
  imports: [CommonModule, NavbarWebComponent, RouterLink, FooterWebComponent],
  templateUrl: './view-web.component.html',
  styleUrls: ['./view-web.component.scss']
})
export class ViewWebComponent {
  // Lógica de la landing page si es necesaria en el futuro
}