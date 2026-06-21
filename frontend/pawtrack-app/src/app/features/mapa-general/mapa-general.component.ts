import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { SentenceCasePipe } from '../../shared/pipes/sentence-case-pipe';

declare let L: any;

interface RespuestaIncidencias {
  count: number;
  next: string | null;
  previous: string | null;
  results: IncidenciaMapa[];
}

interface IncidenciaMapa {
  id: number;

  usuario_reporta?: number | null;
  animal?: number | null;
  patrocinador?: number | null;
  rescatista_asignado?: number | null;

  imagen: string | null;

  lat_out: number | null;
  lng_out: number | null;

  tipo_animal: string;
  tamano_animal: string;
  condicion_animal: string;
  edad_estimada: string;
  peso_estimado: string;

  nombre_caso?: string;
  caracteristicas: string;

  estado: string;
  tipo_incidencia: string;
  recompensa: number | null;

  urgency_score: number;
  trust_score: number;
  created_at: string;
  folio: string;
}

@Component({
  selector: 'app-mapa-general',
  templateUrl: './mapa-general.component.html',
  styleUrls: ['./mapa-general.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    HttpClientModule,
    SentenceCasePipe,
    NavbarWebComponent,
    FooterWebComponent
  ]
})
export class MapaGeneralComponent implements OnInit, AfterViewInit, OnDestroy {
  private mapaCasos: any;
  private capaMarcadores: any;

  private readonly apiIncidenciasUrl = 'http://localhost:8000/api/incidencias/';

  casosActivos: IncidenciaMapa[] = [];
  cargandoCasos = false;
  errorCasos = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.programarInicializacionMapa();
  }

  ionViewDidEnter(): void {
    this.programarInicializacionMapa();
  }

  ngOnDestroy(): void {
    if (this.mapaCasos) {
      this.mapaCasos.remove();
      this.mapaCasos = null;
    }
  }

  private programarInicializacionMapa(): void {
    requestAnimationFrame(() => {
      this.initMapaCasos();
    });
  }

  private initMapaCasos(): void {
    if (typeof L === 'undefined') {
      console.error('Leaflet no está cargado. Revisa que Leaflet esté importado en el proyecto.');
      return;
    }

    if (this.mapaCasos) {
      this.mapaCasos.invalidateSize();
      this.cargarCasosActivos();
      return;
    }

    this.mapaCasos = L.map('mapa-casos', {
      zoomControl: true,
      attributionControl: true
    }).setView([19.0042, -98.2012], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.mapaCasos);

    this.capaMarcadores = L.layerGroup().addTo(this.mapaCasos);

    this.cargarCasosActivos();

    requestAnimationFrame(() => {
      this.mapaCasos.invalidateSize();
    });
  }

  private cargarCasosActivos(): void {
    this.cargandoCasos = true;
    this.errorCasos = '';

    this.http.get<RespuestaIncidencias>(this.apiIncidenciasUrl)
      .subscribe({
        next: (respuesta) => {
          console.log('Incidencias recibidas:', respuesta);

          this.casosActivos = (respuesta.results || []).filter(caso =>
            caso.estado !== 'RESUELTO' &&
            caso.lat_out !== null &&
            caso.lng_out !== null
          );

          this.pintarCasosActivos();
          this.cargandoCasos = false;
        },
        error: (error) => {
          console.error('Error cargando incidencias:', error);
          this.errorCasos = 'No se pudieron cargar las incidencias.';
          this.cargandoCasos = false;
        }
      });
  }

  private pintarCasosActivos(): void {
    if (!this.mapaCasos || !this.capaMarcadores) return;

    this.capaMarcadores.clearLayers();

    const iconoCasoActivo = L.divIcon({
      className: 'pin-caso-activo',
      html: '<div class="pin-paw">🐾</div>',
      iconSize: [42, 42],
      iconAnchor: [21, 42],
      popupAnchor: [0, -42]
    });

    const puntos: any[] = [];

    this.casosActivos.forEach(caso => {
      if (caso.lat_out === null || caso.lng_out === null) return;

      const marcador = L.marker([caso.lat_out, caso.lng_out], { icon: iconoCasoActivo })
        .addTo(this.capaMarcadores)
        .bindPopup(this.crearPopupCaso(caso), {
          maxWidth: 280,
          minWidth: 250,
          className: 'popup-caso-activo'
        });

      puntos.push([caso.lat_out, caso.lng_out]);
    });

    if (puntos.length > 1) {
      this.mapaCasos.fitBounds(puntos, {
        padding: [40, 40]
      });
    } else if (puntos.length === 1) {
      this.mapaCasos.setView(puntos[0], 15);
    }
  }

  private crearPopupCaso(caso: IncidenciaMapa): string {
    const titulo = this.escapeHtml(this.obtenerTituloCaso(caso));
    const tipoAnimal = this.escapeHtml(caso.tipo_animal || 'Animal');
    const condicion = this.escapeHtml(caso.condicion_animal || 'Sin condición');
    const estado = this.escapeHtml(caso.estado || 'Sin estado');
    const tipoIncidencia = this.escapeHtml(caso.tipo_incidencia || 'REPORTE');
    const caracteristicas = this.escapeHtml(caso.caracteristicas || 'Sin características adicionales.');
    const folio = this.escapeHtml(caso.folio || 'Sin folio');

    const imagenHtml = caso.imagen
      ? `<img src="${this.obtenerUrlImagen(caso.imagen)}" alt="${titulo}" class="popup-image">`
      : `<div class="popup-image-placeholder">🐾</div>`;

    return `
      <div class="popup-card">
        <div class="popup-image-wrapper">
          ${imagenHtml}
          <span class="popup-badge">${tipoIncidencia}</span>
        </div>

        <div class="popup-content">
          <h3>${titulo}</h3>

          <p class="popup-type">
            ${tipoAnimal} · ${condicion}
          </p>

          <p class="popup-location">
            Estado: <strong>${estado}</strong>
          </p>

          <p class="popup-description">
            ${caracteristicas}
          </p>

          <p class="popup-folio">
            Folio: ${folio}
          </p>
        </div>
      </div>
    `;
  }

  obtenerTituloCaso(caso: IncidenciaMapa): string {
    if (caso.nombre_caso && caso.nombre_caso.trim() !== '') {
      return caso.nombre_caso;
    }

    if (caso.tipo_animal && caso.tipo_animal.trim() !== '') {
      return `${caso.tipo_animal} reportado`;
    }

    return 'Animal reportado';
  }

  obtenerUrlImagen(imagen: string | null): string {
  if (!imagen) {
    return '';
  }

  if (imagen.startsWith('http')) {
    return imagen;
  }

  return `http://localhost:8000${imagen}`;
}

  private escapeHtml(valor: string): string {
    return valor
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  centrarCaso(caso: IncidenciaMapa): void {
    if (!this.mapaCasos) return;
    if (caso.lat_out === null || caso.lng_out === null) return;

    this.mapaCasos.setView([caso.lat_out, caso.lng_out], 16);
  }
}
