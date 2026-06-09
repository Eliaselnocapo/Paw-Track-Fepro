import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

declare const L: any;

@Component({
  selector: 'app-view-report',
  templateUrl: './view-report.page.html',
  styleUrls: ['./view-report.page.scss'],
  standalone: true,
  imports: [CommonModule, TitleCasePipe, IonContent],
})
export class ViewReportPage implements OnInit, AfterViewInit, OnDestroy {

  private mapaReporte: any = null;

  reporte = {
    folio: '4092',
    tipoAnimal: 'perro',
    tamano: 'mediano',
    condicionPrincipal: 'herido',
    descripcionCondicion: 'Pierna visible lastimada cubierta con un vendaje sucio',
    fotoUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800&auto=format&fit=crop',
    tiempoTranscurrido: '2h',
    direccion: 'Avenida Insurgentes Sur 123, Roma Norte',
    ciudad: 'Mexico City',
    lat: 19.4195,
    lng: -99.1617,
    timeline: [
      {
        id: 1,
        hora: 'Today, 14:30',
        titulo: 'Voluntario Asignado',
        descripcion: 'Maria esta en ruta para apoyar al animal',
        activo: true
      },
      {
        id: 2,
        hora: 'Today, 14:15',
        titulo: 'Caso Verificado',
        descripcion: 'Usuario confirmó detalles y situación',
        activo: false
      },
      {
        id: 3,
        hora: 'Today, 14:00',
        titulo: 'Reporte Inicial',
        descripcion: 'Reporte creado por usuario anonimo en la app',
        activo: false
      }
    ]
  };

  constructor(private router: Router) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    setTimeout(() => this.initMapa(), 800);
  }

  ngOnDestroy(): void {
    if (this.mapaReporte) {
      this.mapaReporte.off();
      this.mapaReporte.remove();
      this.mapaReporte = null;
    }
  }

  private initMapa(): void {
    const contenedor = document.getElementById('mapa-reporte');
    if (!contenedor || this.mapaReporte) return;

    this.mapaReporte = L.map('mapa-reporte', {
      center: [this.reporte.lat, this.reporte.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.mapaReporte);

    L.circleMarker([this.reporte.lat, this.reporte.lng], {
      radius: 10,
      fillColor: '#ba1a1a',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(this.mapaReporte);

    setTimeout(() => this.mapaReporte?.invalidateSize(), 150);
  }

  regresar(): void {
    this.router.navigate(['/home']);
  }
}
