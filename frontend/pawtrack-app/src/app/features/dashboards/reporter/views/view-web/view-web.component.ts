import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { NavbarWebComponent } from '../../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

interface ReporterReport {
  id: string;
  title: string;
  status: 'validating' | 'on_way' | 'pending_review' | 'completed';
  address: string;
  reportedAt: string;
  animalType: 'dog' | 'cat' | 'bird' | 'other';
  imageUrl?: string;
  eta?: string;
}

@Component({
  selector: 'app-view-web',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarWebComponent,
    FooterWebComponent
  ],
  templateUrl: './view-web.component.html',
  styleUrls: ['./view-web.component.scss'],
})
export class ViewWebComponent {
  reports: ReporterReport[] = [
    {
      id: 'RPT-8429',
      title: 'Perro callejero herido',
      status: 'validating',
      address: 'Av. Insurgentes Sur 105, CDMX',
      reportedAt: 'Reportado hace 10 minutos',
      animalType: 'dog',
      imageUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=400&auto=format&fit=crop',
    },
    {
      id: 'RPT-8425',
      title: 'Gato atrapado en alcantarilla',
      status: 'on_way',
      address: 'Calle Roma 24, CDMX',
      reportedAt: 'Reportado hace 20 minutos',
      animalType: 'cat',
      eta: 'ETA: 5 minutos',
    },
    {
      id: 'RPT-8430',
      title: 'Ave con ala lastimada',
      status: 'on_way',
      address: 'Parque México, CDMX',
      reportedAt: 'Reportado hace 5 minutos',
      animalType: 'bird',
    },
    {
      id: 'RPT-8431',
      title: 'Cachorro abandonado',
      status: 'pending_review',
      address: 'Col. Roma, CDMX',
      reportedAt: 'Reportado ahora',
      animalType: 'dog',
    },
  ];

  getStatusLabel(status: ReporterReport['status']): string {
    const labels = {
      validating: 'Validando',
      on_way: 'Rescatista en camino',
      pending_review: 'Pendiente',
      completed: 'Completado',
    };

    return labels[status];
  }

  getStatusClass(status: ReporterReport['status']): string {
    const classes = {
      validating: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      on_way: 'bg-blue-100 text-blue-700 border-blue-200',
      pending_review: 'bg-orange-100 text-orange-700 border-orange-200',
      completed: 'bg-slate-100 text-slate-600 border-slate-200',
    };

    return classes[status];
  }

  getAnimalIcon(animalType: ReporterReport['animalType']): string {
    const icons = {
      dog: 'pets',
      cat: 'pets',
      bird: 'flutter_dash',
      other: 'cruelty_free',
    };

    return icons[animalType];
  }

  getActionLabel(status: ReporterReport['status']): string {
    if (status === 'validating') return 'Actualizar';
    if (status === 'on_way') return 'Rastrear';
    if (status === 'pending_review') return 'Ver detalles';

    return 'Ver reporte';
  }
}