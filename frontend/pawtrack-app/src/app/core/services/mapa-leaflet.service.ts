// core/services/mapa-leaflet.service.ts
import { Injectable } from '@angular/core';

declare let L: any;

export interface OpcionesMapa {
  contenedorId: string;
  lat: number;
  lng: number;
  zoom?: number;
  zoomControl?: boolean;
  scrollWheelZoom?: boolean;
  attributionControl?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapaLeafletService {

  /**
   * Crea un mapa Leaflet estándar (mismo tile layer en toda la app).
   * Se asegura de que el contenedor exista en el DOM antes de crear.
   */
  crear(opciones: OpcionesMapa): any {
    const el = document.getElementById(opciones.contenedorId);
    if (!el) {
      console.error(`No se encontró el contenedor #${opciones.contenedorId}`);
      return null;
    }

    const mapa = L.map(opciones.contenedorId, {
      zoomControl: opciones.zoomControl ?? true,
      attributionControl: opciones.attributionControl ?? true,
      scrollWheelZoom: opciones.scrollWheelZoom ?? true,
    }).setView([opciones.lat, opciones.lng], opciones.zoom ?? 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapa);

    return mapa;
  }

  /**
   * Destruye un mapa de forma segura. Llamar SIEMPRE en ngOnDestroy().
   * No truena si el mapa ya es null o ya fue destruido.
   */
  destruir(mapa: any): null {
    if (mapa) {
      mapa.remove();
    }
    return null; // para reasignar directo: this.mapa = this.mapaService.destruir(this.mapa);
  }

  /** Recalcula tamaño — útil cuando el contenedor tarda en tener alto real (mismo patrón que ya usas). */
  invalidarTamano(mapa: any, delays: number[] = [300, 700]): void {
    delays.forEach(ms => setTimeout(() => mapa?.invalidateSize(), ms));
  }

  crearIconoPin(html: string, className = 'pin-generico', size: [number, number] = [40, 40]): any {
    return L.divIcon({
      className,
      html,
      iconSize: size,
      iconAnchor: [size[0] / 2, size[1]],
    });
  }
}