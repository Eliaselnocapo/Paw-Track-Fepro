import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { IonContent } from '@ionic/angular/standalone';

interface CasoVoluntario {
  id: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  tiempo: string;
  prioridad: 'Urgente' | 'Alta' | 'Moderada';
  especie: 'Perro' | 'Gato' | 'Otro';
  fotoUrl: string;
}

@Component({
  selector: 'app-volunteer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarWebComponent, FooterWebComponent, IonContent],
  templateUrl: './volunteer.page.html',
  styleUrls: ['./volunteer.page.scss']
})
export class VolunteerPage {
  // Término de búsqueda enlazado al input
  searchTerm: string = '';
  filtroActivo: string = 'Todos';

  // Base de datos de prueba
  casos: CasoVoluntario[] = [
    {
      id: 'RPT-001',
      titulo: 'Perro herido en avenida',
      descripcion: 'Reporte de perro tamaño mediano con posible lesión en pata trasera tras ser golpeado por un auto. Se encuentra asustado bajo un puente.',
      ubicacion: 'Col. Roma Norte, CDMX',
      tiempo: 'Hace 15 min',
      prioridad: 'Urgente',
      especie: 'Perro',
      fotoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=500&auto=format&fit=crop'
    },
    {
      id: 'RPT-002',
      titulo: 'Gato atrapado en árbol',
      descripcion: 'Gato doméstico asustado atrapado en árbol de aproximadamente 4 metros de altura. Dueño presente en el lugar sin equipo para subir.',
      ubicacion: 'Col. Condesa, Parque México',
      tiempo: 'Hace 1 hora',
      prioridad: 'Moderada',
      especie: 'Gato',
      fotoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=500&auto=format&fit=crop'
    },
    {
      id: 'RPT-003',
      titulo: 'Cachorro desorientado',
      descripcion: 'Cachorro vagando solo cerca de avenida principal. Alto riesgo de atropellamiento. Trae collar rojo sin placa.',
      ubicacion: 'Col. Escandón, CDMX',
      tiempo: 'Hace 45 min',
      prioridad: 'Alta',
      especie: 'Perro',
      fotoUrl: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=500&auto=format&fit=crop'
    }
  ];

  // Getter mágico que filtra la lista en tiempo real
  get casosFiltrados(): CasoVoluntario[] {
    let filtrados = this.casos;

    // Filtro por botones (píldoras)
    if (this.filtroActivo !== 'Todos') {
      filtrados = filtrados.filter(c => c.prioridad === this.filtroActivo);
    }

    // Filtro por la barra de búsqueda (título, descripción o ubicación)
    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase();
      filtrados = filtrados.filter(c => 
        c.titulo.toLowerCase().includes(term) || 
        c.ubicacion.toLowerCase().includes(term) ||
        c.descripcion.toLowerCase().includes(term)
      );
    }

    return filtrados;
  }

  setFiltro(filtro: string) {
    this.filtroActivo = filtro;
  }

  aceptarMision(id: string) {
    console.log('Misión aceptada:', id);
    // Aquí iría tu lógica con el servicio para cambiar el estado de la incidencia en Django
  }
}