import { Component, Input, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { IonContent } from '@ionic/angular/standalone';

// Declaramos Leaflet aquí porque el Hijo dibuja el mapa
declare const L: any;

@Component({
  selector: 'app-view-movil',
  standalone: true,
  imports: [CommonModule, IonContent, TitleCasePipe],
  templateUrl: './view-movil.component.html',
  styleUrls: ['./view-movil.component.scss']
})
export class ViewMovilComponent implements AfterViewInit, OnDestroy {
  
  // Recibimos los datos y enviamos el evento
  @Input() reporte: any; 
  @Output() regresarEvent = new EventEmitter<void>();

  private mapaReporte: any = null;

  ngAfterViewInit(): void {
    // Esperamos a que el HTML termine de cargar para dibujar el mapa
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
    // Verificamos que tengamos la info del reporte antes de dibujar
    if (!contenedor || this.mapaReporte || !this.reporte) return;

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

  regresar() {
    this.regresarEvent.emit();
  }
}