import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
  ],
  templateUrl: './cooming-soon.page.html',
})
export class ComingSoonPage {

  // Se puede personalizar por ruta, ej:
  // <app-coming-soon titulo="Reportes" mensaje="Estamos afinando..."></app-coming-soon>
  @Input() titulo = 'Esta sección';
  @Input() mensaje =
    'Todavía estamos trabajando en esto. Vuelve pronto, lo vamos a tener listo.';
  @Input() rutaVolver = '/';
}