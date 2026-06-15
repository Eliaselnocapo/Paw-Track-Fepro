import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent } from '@ionic/angular/standalone';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { NavbarWebComponent } from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    FooterWebComponent,
    NavbarWebComponent
  ],
})
export class ProfilePage implements OnInit {

  esPantallaGrande = window.innerWidth >= 768;

  usuario = {
    nombre: 'Elena Rodriguez',
    rol: 'Reporter',
    email: 'elena.rodriguez@example.com',
    ubicacion: 'Mexico City, MX',
    fotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop',
    reportesTotales: 42,
    animalesRescatados: 15,
    reportesRecientes: [
      {
        id: 1,
        titulo: 'Perro callejero',
        descripcion: 'Mezcla marrón de tamaño mediano vista merodeando cerca de la entrada sur. Parecía amigable pero hambrienta. Collar presente.',
        fecha: 'Oct 24, 2024',
        lugar: 'Distrito las Torres',
        estado: 'Resuelto',
        fotoUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=400&auto=format&fit=crop'
      },
      {
        id: 2,
        titulo: 'Perro herido',
        descripcion: 'Pequeño perro negro escondido detrás de los contenedores de basura. Parece tener una pata trasera lesionada.',
        fecha: 'Oct 22, 2024',
        lugar: 'Mercado de Sabores',
        estado: 'Urgente',
        fotoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=400&auto=format&fit=crop'
      }
    ]
  };

  ngOnInit(): void {}

  @HostListener('window:resize')
  onResize() {
    this.esPantallaGrande = window.innerWidth >= 768;
  }
}
