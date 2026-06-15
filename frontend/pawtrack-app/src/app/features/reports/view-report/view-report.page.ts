import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';

declare const L: any;

@Component({
  selector: 'app-view-report',
  standalone: true,
  imports: [CommonModule, NavbarWebComponent, RouterLink, IonContent, FooterWebComponent],
  templateUrl: './view-report.page.html',
  styleUrls: ['./view-report.page.scss']
})
export class ViewReportComponent implements AfterViewInit, OnDestroy {
  constructor(private location: Location) {}
  // Quitamos @Input() y asignamos datos temporales para evitar el error 'undefined'
  // (Más adelante llenarás esto llamando a tu backend)
  reporte: any = {
    folio: '2024-05-17A',
    estadoAnimal: 'En ruta a clínica',
    urgencia: 75,
    condiciones: {
      herido: true,
      deshidratado: false,
      asustado: true
    },
    tipoAnimal: 'Perro',
    direccion: 'Callejón del Gato Negro #14, CDMX',
    lat: 19.432608, // Coordenada de prueba para tu mapa
    lng: -99.133209 // Coordenada de prueba para tu mapa
  };

  private mapaWeb: any = null;
  
  ngAfterViewInit(): void {
    // Retraso para asegurar que el div del mapa ya exista en pantalla
    setTimeout(() => this.initMapa(), 500);
  }

  ngOnDestroy(): void {
    if (this.mapaWeb) {
      this.mapaWeb.off();
      this.mapaWeb.remove();
      this.mapaWeb = null;
    }
  }

  private initMapa(): void {
    const contenedor = document.getElementById('mapa-reporte-web');
    if (!contenedor || this.mapaWeb || !this.reporte) return;

    this.mapaWeb = L.map('mapa-reporte-web', {
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
    }).addTo(this.mapaWeb);

    L.circleMarker([this.reporte.lat, this.reporte.lng], {
      radius: 10,
      fillColor: '#ba1a1a',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(this.mapaWeb);

    setTimeout(() => this.mapaWeb?.invalidateSize(), 150);
    
    
  }
  regresar() {
    this.location.back(); // Esto te regresa a la página anterior exacta
  }
  
}