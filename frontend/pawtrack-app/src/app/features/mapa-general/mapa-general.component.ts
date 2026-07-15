import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  HttpClient,
  HttpClientModule
} from '@angular/common/http';

import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  barbellOutline,
  calendarOutline,
  cashOutline,
  closeOutline,
  documentTextOutline,
  medkitOutline,
  pawOutline,
  resizeOutline
} from 'ionicons/icons';

import { NavbarWebComponent } from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { SentenceCasePipe } from '../../shared/pipes/sentence-case-pipe';

import { environment } from 'src/environments/environment';

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
  direccion?: string;

  tipo_animal: string;
  tamano_animal: string;
  condicion_animal: string;
  notas_animal?: string;
  edad_estimada: string;
  peso_estimado: string;

  nombre_caso?: string;
  nombre_contacto?: string;
  telefono_contacto?: string;
  caracteristicas: string;
  ficha_voluntario?: string;

  estado: string;
  tipo_incidencia: string;
  recompensa: number | null;

  urgency_score: number;
  trust_score: number;

  created_at: string;
  updated_at?: string;
  folio: string;
}

@Component({
  selector: 'app-mapa-general',
  templateUrl: './mapa-general.component.html',
  styleUrls: ['./mapa-general.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,

    IonContent,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonChip,
    IonList,
    IonItem,
    IonLabel,

    SentenceCasePipe,
    NavbarWebComponent,
    FooterWebComponent
  ]
})
export class MapaGeneralComponent
  implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('contenidoPagina')
  private contenidoPagina!: IonContent;

  @ViewChild('seccionMapa', { read: ElementRef })
  private seccionMapa!: ElementRef<HTMLElement>;

  private mapaCasos: any;
  private capaMarcadores: any;

  private readonly apiIncidenciasUrl =
    `${environment.apiUrl}/incidencias/`;

  casosActivos: IncidenciaMapa[] = [];

  cargandoCasos = false;
  errorCasos = '';

  casoSeleccionado: IncidenciaMapa | null = null;
  modalCasoAbierto = false;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone
  ) {
    addIcons({
      closeOutline,
      pawOutline,
      medkitOutline,
      resizeOutline,
      calendarOutline,
      barbellOutline,
      documentTextOutline,
      cashOutline
    });
  }

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
      this.capaMarcadores = null;
    }
  }

  private programarInicializacionMapa(): void {
    requestAnimationFrame(() => {
      this.initMapaCasos();
    });
  }

  private initMapaCasos(): void {
    if (typeof L === 'undefined') {
      console.error(
        'Leaflet no está cargado. Revisa que Leaflet esté importado en el proyecto.'
      );

      return;
    }

    if (this.mapaCasos) {
      this.mapaCasos.invalidateSize();
      this.cargarCasosActivos();
      return;
    }

    const contenedorMapa =
      document.getElementById('mapa-casos');

    if (!contenedorMapa) {
      console.error(
        'No se encontró el contenedor con id "mapa-casos".'
      );

      return;
    }

    this.mapaCasos = L.map('mapa-casos', {
      zoomControl: true,
      attributionControl: true
    }).setView(
      [19.0042, -98.2012],
      14
    );

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }
    ).addTo(this.mapaCasos);

    this.capaMarcadores = L.layerGroup()
      .addTo(this.mapaCasos);

    this.cargarCasosActivos();

    requestAnimationFrame(() => {
      this.mapaCasos?.invalidateSize();
    });
  }

  private cargarCasosActivos(): void {
    this.cargandoCasos = true;
    this.errorCasos = '';

    this.http
      .get<RespuestaIncidencias>(
        this.apiIncidenciasUrl
      )
      .subscribe({
        next: (respuesta) => {
          console.log(
            'Incidencias recibidas:',
            respuesta
          );

          this.casosActivos =
            (respuesta.results || []).filter(
              (caso) =>
                caso.estado !== 'RESUELTO' &&
                caso.lat_out !== null &&
                caso.lng_out !== null
            );

          this.pintarCasosActivos();
          this.cargandoCasos = false;
        },

        error: (error) => {
          console.error(
            'Error cargando incidencias:',
            error
          );

          this.errorCasos =
            'No se pudieron cargar las incidencias.';

          this.cargandoCasos = false;
        }
      });
  }

  private pintarCasosActivos(): void {
    if (!this.mapaCasos || !this.capaMarcadores) {
      return;
    }

    this.capaMarcadores.clearLayers();

    const iconoCasoActivo = L.divIcon({
      className: 'pin-caso-activo',
      html: '<div class="pin-paw">🐾</div>',
      iconSize: [42, 42],
      iconAnchor: [21, 42],
      popupAnchor: [0, -42]
    });

    const puntos: [number, number][] = [];

    this.casosActivos.forEach((caso) => {
      if (
        caso.lat_out === null ||
        caso.lng_out === null
      ) {
        return;
      }

      const coordenadas: [number, number] = [
        caso.lat_out,
        caso.lng_out
      ];

      const marcador = L.marker(
        coordenadas,
        {
          icon: iconoCasoActivo
        }
      ).addTo(this.capaMarcadores);

      /*
       * En escritorio se conserva el popup.
       * En móvil no se agrega el popup, porque se abre el modal.
       */
      if (!this.esVistaMovil()) {
        marcador.bindPopup(
          this.crearPopupCaso(caso),
          {
            maxWidth: 280,
            minWidth: 250,
            className: 'popup-caso-activo'
          }
        );
      }

      /*
       * Tanto en escritorio como en móvil:
       * 1. Regresa el scroll al mapa.
       * 2. Centra las coordenadas.
       * 3. En móvil abre el modal.
       * 4. En escritorio abre el popup.
       */
      marcador.on('click', () => {
        this.ngZone.run(() => {
          void this.manejarClickMarcador(
            caso,
            coordenadas,
            marcador
          );
        });
      });

      puntos.push(coordenadas);
    });

    if (puntos.length > 1) {
      this.mapaCasos.fitBounds(
        puntos,
        {
          padding: [40, 40]
        }
      );
    } else if (puntos.length === 1) {
      this.mapaCasos.setView(
        puntos[0],
        15
      );
    }
  }

  private async manejarClickMarcador(
    caso: IncidenciaMapa,
    coordenadas: [number, number],
    marcador: any
  ): Promise<void> {
    await this.desplazarAlMapa();

    this.mapaCasos?.setView(
      coordenadas,
      16
    );

    if (this.esVistaMovil()) {
      this.abrirModalCaso(caso);
      return;
    }

    marcador.openPopup();
  }

  /**
   * Mueve suavemente el scroll interno de ion-content
   * hasta la sección donde se encuentra el mapa.
   */
  private async desplazarAlMapa(): Promise<void> {
    if (
      !this.contenidoPagina ||
      !this.seccionMapa
    ) {
      return;
    }

    try {
      const scrollElement =
        await this.contenidoPagina.getScrollElement();

      const rectanguloMapa =
        this.seccionMapa.nativeElement.getBoundingClientRect();

      const rectanguloContenido =
        scrollElement.getBoundingClientRect();

      /*
       * 90 px de separación para evitar que la navbar fija
       * cubra la parte superior del mapa.
       */
      const espacioNavbar = 90;

      const destinoY =
        scrollElement.scrollTop +
        rectanguloMapa.top -
        rectanguloContenido.top -
        espacioNavbar;

      await this.contenidoPagina.scrollToPoint(
        0,
        Math.max(destinoY, 0),
        450
      );

      requestAnimationFrame(() => {
        this.mapaCasos?.invalidateSize();
      });
    } catch (error) {
      console.error(
        'No fue posible desplazar la página al mapa:',
        error
      );

      /*
       * Respaldo para navegadores donde el scroll interno
       * de Ionic no responda correctamente.
       */
      this.seccionMapa.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  private esVistaMovil(): boolean {
    return window.matchMedia(
      '(max-width: 768px)'
    ).matches;
  }

  abrirModalCaso(caso: IncidenciaMapa): void {
    this.casoSeleccionado = caso;
    this.modalCasoAbierto = true;
  }

  cerrarModalCaso(): void {
    this.modalCasoAbierto = false;
    this.casoSeleccionado = null;
  }

  private crearPopupCaso(
    caso: IncidenciaMapa
  ): string {
    const titulo = this.escapeHtml(
      this.obtenerTituloCaso(caso)
    );

    const tipoAnimal = this.escapeHtml(
      caso.tipo_animal || 'Animal'
    );

    const condicion = this.escapeHtml(
      caso.condicion_animal || 'Sin condición'
    );

    const estado = this.escapeHtml(
      caso.estado || 'Sin estado'
    );

    const tipoIncidencia = this.escapeHtml(
      caso.tipo_incidencia || 'REPORTE'
    );

    const caracteristicas = this.escapeHtml(
      caso.caracteristicas ||
      caso.notas_animal ||
      'Sin características adicionales.'
    );

    const folio = this.escapeHtml(
      caso.folio || 'Sin folio'
    );

    const imagenHtml = caso.imagen
      ? `
        <img
          src="${this.escapeHtml(
            this.obtenerUrlImagen(caso.imagen)
          )}"
          alt="${titulo}"
          class="popup-image"
        >
      `
      : `
        <div class="popup-image-placeholder">
          🐾
        </div>
      `;

    return `
      <div class="popup-card">
        <div class="popup-image-wrapper">
          ${imagenHtml}

          <span class="popup-badge">
            ${tipoIncidencia}
          </span>
        </div>

        <div class="popup-content">
          <h3>${titulo}</h3>

          <p class="popup-type">
            ${tipoAnimal} · ${condicion}
          </p>

          <p class="popup-location">
            Estado:
            <strong>${estado}</strong>
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

  obtenerTituloCaso(
    caso: IncidenciaMapa
  ): string {
    if (
      caso.nombre_caso &&
      caso.nombre_caso.trim() !== ''
    ) {
      return caso.nombre_caso;
    }

    if (
      caso.tipo_animal &&
      caso.tipo_animal.trim() !== ''
    ) {
      return `${caso.tipo_animal} reportado`;
    }

    return 'Animal reportado';
  }

  obtenerUrlImagen(
    imagen: string | null
  ): string {
    if (!imagen) {
      return '';
    }

    if (
      imagen.startsWith('http://') ||
      imagen.startsWith('https://')
    ) {
      return imagen;
    }

    const apiUrlSinDiagonal =
      environment.apiUrl.replace(/\/$/, '');

    const imagenConDiagonal =
      imagen.startsWith('/')
        ? imagen
        : `/${imagen}`;

    return `${apiUrlSinDiagonal}${imagenConDiagonal}`;
  }

  private escapeHtml(valor: string): string {
    return String(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Se ejecuta al hacer clic en una tarjeta.
   */
  async centrarCaso(
    caso: IncidenciaMapa
  ): Promise<void> {
    if (!this.mapaCasos) {
      return;
    }

    if (
      caso.lat_out === null ||
      caso.lng_out === null
    ) {
      return;
    }

    await this.desplazarAlMapa();

    this.mapaCasos.setView(
      [caso.lat_out, caso.lng_out],
      16
    );

    if (this.esVistaMovil()) {
      this.abrirModalCaso(caso);
      return;
    }

    /*
     * En escritorio buscamos el marcador correspondiente
     * y abrimos su popup.
     */
    this.capaMarcadores?.eachLayer(
      (marcador: any) => {
        const coordenadas =
          marcador.getLatLng?.();

        if (!coordenadas) {
          return;
        }

        const mismaLatitud =
          coordenadas.lat === caso.lat_out;

        const mismaLongitud =
          coordenadas.lng === caso.lng_out;

        if (
          mismaLatitud &&
          mismaLongitud
        ) {
          marcador.openPopup?.();
        }
      }
    );
  }
}