import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router'; // <--- Importa RouterLink
import { IonContent } from '@ionic/angular/standalone'; // Solo importa lo que realmente usas en el HTML
import { NavbarWebComponent } from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component'; // Ajusta el nombre del archivo si es diferente
import { FooterWebComponent } from '../../shared/ui-layouts/footer-views/footer-web/footer-web.component';     // Ajusta el nombre del archivo si es diferente

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    NavbarWebComponent, // <--- REGÍSTRALOS AQUÍ
    FooterWebComponent  // <--- REGÍSTRALOS AQUÍ
  ]
})
export class HomePage implements OnInit {
  constructor() { }

  ngOnInit() {
  }
}