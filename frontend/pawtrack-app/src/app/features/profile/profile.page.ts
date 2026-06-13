import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { NavbarComponent } from '../../shared/ui-layouts/navbar/navbar.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, NavbarComponent],
})
export class ProfilePage implements OnInit {

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

  constructor(private router: Router) {}

  ngOnInit(): void {}
}
