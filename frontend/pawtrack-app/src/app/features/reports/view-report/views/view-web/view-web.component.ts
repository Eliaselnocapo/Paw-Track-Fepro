import { Component, Input, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarWebComponent } from '../../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';

declare const L: any;

@Component({
  selector: 'app-view-web',
  standalone: true,
  imports: [CommonModule, NavbarWebComponent],
  templateUrl: './view-web.component.html',
  styleUrls: ['./view-web.component.scss']
})
export class ViewWebComponent implements AfterViewInit, OnDestroy {
  
  // Recibimos los datos y enviamos el evento
  @Input() reporte: any; 
  @Output() regresarEvent = new EventEmitter<void>();

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
    this.regresarEvent.emit();
  }
}