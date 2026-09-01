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
import { Router } from '@angular/router';
import { RevealDirective } from '../../../../src/app/shared/directives/reveal.directive';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ReportService, RescateResponse } from '../../../../src/app/core/services/report.service';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';

import {
  IonButton,
  IonChip,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  barbellOutline,
  calendarOutline,
  cashOutline,
  chevronDownOutline,
  chevronUpOutline,
  closeOutline,
  documentTextOutline,
  medkitOutline,
  pawOutline,
  resizeOutline
} from 'ionicons/icons';

import { NavbarWebComponent } from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { SentenceCasePipe } from '../../shared/pipes/sentence-case-pipe';
import { environment } from '../../../../src/environments/environment';

import * as L from 'leaflet';

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
    IonButton,
    IonIcon,
    IonChip,
    IonList,
    IonItem,
    IonLabel,
    SentenceCasePipe,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
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
  private marcadorUsuario: any;

  private readonly apiIncidenciasUrl =
    `${environment.apiUrl}/incidencias/`;

  todosLosCasos: IncidenciaMapa[] = [];
  filtro: 'pendientes' | 'aceptados' | 'todos' = 'pendientes';
  cargandoCasos = false;
  errorCasos = '';

  ubicacionUsuario: { lat: number; lng: number } | null = null;
  cargandoUbicacion = false;
  verTodoElPais = false;
  radioKm = 20;
  misCasosAceptados: IncidenciaMapa[] = [];

  @ViewChild('modalCaso')
  private modalCaso!: IonModal;

  casoSeleccionado: IncidenciaMapa | null = null;
  modalCasoAbierto = false;

  get casosActivos(): IncidenciaMapa[] {
    const terminados = ['CERRADO', 'COMPLETADO', 'CANCELADO'];

    if (this.filtro === 'aceptados') {
      // Siempre tus propios aceptados, sin importar ubicación.
      return this.misCasosAceptados.filter(
        (caso) => !terminados.includes(caso.estado) && caso.lat_out !== null && caso.lng_out !== null
      );
    }

    return this.todosLosCasos.filter((caso) => {
      if (terminados.includes(caso.estado)) return false;
      if (caso.lat_out === null || caso.lng_out === null) return false;

      if (this.filtro === 'pendientes') return caso.rescatista_asignado == null;

      return true; // 'todos' — ya incluye tus aceptados aunque estén lejos, gracias al merge
    });
  }

  seleccionarFiltro(filtro: 'pendientes' | 'aceptados' | 'todos'): void {
    if (this.filtro === filtro) return;
    this.filtro = filtro;
    this.pintarCasosActivos(); // solo repinta con los datos que ya tenemos
  }

  mostrarAlertasMobile = true;

  alternarAlertasMobile(): void {
    this.mostrarAlertasMobile = !this.mostrarAlertasMobile;
  }

  conteoFiltro(filtro: 'pendientes' | 'aceptados' | 'todos'): number {
    const terminados = ['CERRADO', 'COMPLETADO', 'CANCELADO'];

    if (filtro === 'aceptados') {
      return this.misCasosAceptados.filter(
        (c) => !terminados.includes(c.estado) && c.lat_out !== null && c.lng_out !== null
      ).length;
    }

    const base = this.todosLosCasos.filter(
      (caso) =>
        !terminados.includes(caso.estado) &&
        caso.lat_out !== null &&
        caso.lng_out !== null
    );

    if (filtro === 'pendientes') return base.filter((c) => c.rescatista_asignado == null).length;
    return base.length; // 'todos'
  }

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private router: Router,
    private reportService: ReportService
  ) {
    addIcons({
      closeOutline,
      pawOutline,
      medkitOutline,
      resizeOutline,
      calendarOutline,
      barbellOutline,
      documentTextOutline,
      cashOutline,
      chevronUpOutline,
      chevronDownOutline
    });
  }

  // ─────────────────────────────────────────
  // FLUJO: mapa aparece YA en BUAP (sin casos) → en paralelo se
  // pide ubicación → cuando resuelve, se mueve el mapa Y AHÍ SÍ
  // se cargan los casos (nunca antes de tener ubicación resuelta).
  // ─────────────────────────────────────────

  ngOnInit(): void {
    this.obtenerUbicacionUsuario();
  }

  ngAfterViewInit(): void {
    this.programarInicializacionMapa();
  }

  ionViewDidEnter(): void {
    if (this.mapaCasos) {
      requestAnimationFrame(() => this.mapaCasos?.invalidateSize());
    } else {
      this.programarInicializacionMapa();
    }
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

  /** Solo crea el mapa vacío en BUAP. NO carga casos aquí. */
  private initMapaCasos(): void {
    if (typeof L === 'undefined') {
      console.error('Leaflet no está cargado.');
      return;
    }

    if (this.mapaCasos) {
      this.mapaCasos.invalidateSize();
      return;
    }

    const contenedorMapa = document.getElementById('mapa-casos');
    if (!contenedorMapa) {
      console.error('No se encontró el contenedor con id "mapa-casos".');
      return;
    }

    this.mapaCasos = L.map('mapa-casos', {
      zoomControl: true,
      attributionControl: true
    }).setView([19.0042, -98.2012], 14); // BUAP, fijo, siempre al inicio

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }
    ).addTo(this.mapaCasos);

    this.capaMarcadores = L.layerGroup().addTo(this.mapaCasos);

    contenedorMapa.addEventListener('click', (event) => {
      const boton = (event.target as HTMLElement)?.closest<HTMLElement>('.popup-cta');
      if (!boton) return;

      const folio = boton.dataset['folio'];
      if (!folio) return;

      boton.blur();

      this.ngZone.run(() => {
        this.irADetalleCaso(folio);
      });
    });

    requestAnimationFrame(() => {
      this.mapaCasos?.invalidateSize();
    });
  }

  /** Pide la ubicación. Cuando resuelve (con o sin éxito), AHÍ SÍ carga los casos. */
  private obtenerUbicacionUsuario(): void {
    if (!navigator.geolocation) {
      this.verTodoElPais = true;
      this.cargarCasosActivos();
      return;
    }

    this.cargandoUbicacion = true;

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        this.ubicacionUsuario = {
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        };
        this.cargandoUbicacion = false;

        if (this.mapaCasos) {
          this.mapaCasos.flyTo([this.ubicacionUsuario.lat, this.ubicacionUsuario.lng], 13, {
            animate: true,
            duration: 1.2,
          });
          this.agregarMarcadorUbicacionUsuario();
        }

        this.cargarCasosActivos();
      },
      () => {
        this.cargandoUbicacion = false;
        this.verTodoElPais = true;
        this.cargarCasosActivos();
      },
      { timeout: 8000 }
    );
  }

  private agregarMarcadorUbicacionUsuario(): void {
    if (!this.ubicacionUsuario || !this.mapaCasos) return;

    this.marcadorUsuario = L.circleMarker(
      [this.ubicacionUsuario.lat, this.ubicacionUsuario.lng],
      {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1
      }
    )
      .bindTooltip('Tu ubicación')
      .addTo(this.mapaCasos);

    this.marcadorUsuario.bringToFront();
  }

  toggleVerTodoElPais(): void {
    this.verTodoElPais = !this.verTodoElPais;
    this.cargarCasosActivos();

    if (!this.verTodoElPais && this.ubicacionUsuario && this.mapaCasos) {
      this.mapaCasos.flyTo([this.ubicacionUsuario.lat, this.ubicacionUsuario.lng], 13, {
        animate: true,
        duration: 1,
      });
    }
  }

  private cargarCasosActivos(): void {
    this.cargandoCasos = true;
    this.errorCasos = '';

    let params = new HttpParams();

    if (!this.verTodoElPais && this.ubicacionUsuario) {
      params = params
        .set('lat', this.ubicacionUsuario.lat.toString())
        .set('lng', this.ubicacionUsuario.lng.toString())
        .set('radio_km', this.radioKm.toString());
    }

    const generales$ = this.http.get<RespuestaIncidencias>(this.apiIncidenciasUrl, { params });

    const misAceptados$ = this.reportService.listarMisRescates().pipe(
      map((resp) => resp.results.map((r: RescateResponse) => r.incidencia as unknown as IncidenciaMapa)),
      catchError(() => of([] as IncidenciaMapa[]))
    );

    forkJoin([generales$, misAceptados$]).subscribe({
      next: ([respGenerales, aceptados]) => {
        const generales = respGenerales.results || [];

        const idsGenerales = new Set(generales.map((c) => c.id));
        const aceptadosFueraDeRadio = aceptados.filter((c) => !idsGenerales.has(c.id));

        this.todosLosCasos = [...generales, ...aceptadosFueraDeRadio];
        this.misCasosAceptados = aceptados;

        this.pintarCasosActivos();
        this.cargandoCasos = false;
      },
      error: (error) => {
        console.error('Error cargando incidencias:', error);
        this.errorCasos = 'No se pudieron cargar las incidencias.';
        this.cargandoCasos = false;
      },
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

    const puntos: [number, number][] = [];

    if (this.ubicacionUsuario && !this.verTodoElPais) {
      puntos.push([this.ubicacionUsuario.lat, this.ubicacionUsuario.lng]);
    }

    this.casosActivos.forEach((caso) => {
      if (caso.lat_out === null || caso.lng_out === null) return;

      const coordenadas: [number, number] = [caso.lat_out, caso.lng_out];

      const marcador = L.marker(coordenadas, { icon: iconoCasoActivo })
        .addTo(this.capaMarcadores);

      if (!this.esVistaMovil()) {
        marcador.bindPopup(
          this.crearPopupCaso(caso),
          { maxWidth: 280, minWidth: 250, className: 'popup-caso-activo' }
        );
      }

      marcador.on('click', () => {
        this.ngZone.run(() => {
          void this.manejarClickMarcador(caso, coordenadas, marcador);
        });
      });

      puntos.push(coordenadas);
    });

    if (puntos.length > 1) {
      this.mapaCasos.fitBounds(puntos, { padding: [40, 40], maxZoom: 14 });
    } else if (puntos.length === 1) {
      this.mapaCasos.setView(puntos[0], 14);
    }
  }

  private async manejarClickMarcador(
    caso: IncidenciaMapa,
    coordenadas: [number, number],
    marcador: any
  ): Promise<void> {
    await this.desplazarAlMapa();
    this.mapaCasos?.setView(coordenadas, 16);

    if (this.esVistaMovil()) {
      this.abrirModalCaso(caso);
      return;
    }

    marcador.openPopup();
  }

  private async desplazarAlMapa(): Promise<void> {
    if (!this.contenidoPagina || !this.seccionMapa) return;

    try {
      const scrollElement = await this.contenidoPagina.getScrollElement();
      const rectanguloMapa = this.seccionMapa.nativeElement.getBoundingClientRect();
      const rectanguloContenido = scrollElement.getBoundingClientRect();
      const espacioNavbar = 90;

      const destinoY =
        scrollElement.scrollTop +
        rectanguloMapa.top -
        rectanguloContenido.top -
        espacioNavbar;

      await this.contenidoPagina.scrollToPoint(0, Math.max(destinoY, 0), 450);

      requestAnimationFrame(() => {
        this.mapaCasos?.invalidateSize();
      });
    } catch (error) {
      console.error('No fue posible desplazar la página al mapa:', error);
      this.seccionMapa.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private esVistaMovil(): boolean {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  async irADetalleCaso(folio: string): Promise<void> {
    if (this.modalCasoAbierto) {
      await this.modalCaso?.dismiss();
    }
    this.casoSeleccionado = null;
    this.router.navigate(['/details-case', folio]);
  }

  abrirModalCaso(caso: IncidenciaMapa): void {
    this.casoSeleccionado = caso;
    this.modalCasoAbierto = true;
  }

  async cerrarModalCaso(): Promise<void> {
    if (this.modalCaso) {
      await this.modalCaso.dismiss();
    }
  }

  onModalCasoCerrado(): void {
    this.modalCasoAbierto = false;
    this.casoSeleccionado = null;
  }

  private crearPopupCaso(caso: IncidenciaMapa): string {
    const titulo = this.escapeHtml(this.obtenerTituloCaso(caso));
    const tipoAnimal = this.escapeHtml(caso.tipo_animal || 'Animal');
    const condicion = this.escapeHtml(caso.condicion_animal || 'Sin condición');
    const estado = this.escapeHtml(caso.estado || 'Sin estado');
    const tipoIncidencia = this.escapeHtml(caso.tipo_incidencia || 'REPORTE');
    const caracteristicas = this.escapeHtml(
      caso.caracteristicas || caso.notas_animal || 'Sin características adicionales.'
    );
    const folio = this.escapeHtml(caso.folio || 'Sin folio');

    const imagenHtml = caso.imagen
      ? `<img src="${this.escapeHtml(this.obtenerUrlImagen(caso.imagen))}" alt="${titulo}" class="popup-image">`
      : `<div class="popup-image-placeholder">🐾</div>`;

    return `
      <div class="popup-card">
        <div class="popup-image-wrapper">
          ${imagenHtml}
          <span class="popup-badge">${tipoIncidencia}</span>
        </div>
        <div class="popup-content">
          <h3>${titulo}</h3>
          <p class="popup-type">${tipoAnimal} · ${condicion}</p>
          <p class="popup-location">Estado: <strong>${estado}</strong></p>
          <p class="popup-description">${caracteristicas}</p>
          <p class="popup-folio">Folio: ${folio}</p>
          <button type="button" class="popup-cta" data-folio="${folio}">Ver ficha del caso</button>
        </div>
      </div>
    `;
  }

  obtenerTituloCaso(caso: IncidenciaMapa): string {
    if (caso.nombre_caso && caso.nombre_caso.trim() !== '') return caso.nombre_caso;
    if (caso.tipo_animal && caso.tipo_animal.trim() !== '') return `${caso.tipo_animal} reportado`;
    return 'Animal reportado';
  }

  obtenerUrlImagen(imagen: string | null): string {
    if (!imagen) return '';
    if (imagen.startsWith('http://') || imagen.startsWith('https://')) return imagen;

    const apiUrlSinDiagonal = environment.apiUrl.replace(/\/$/, '');
    const imagenConDiagonal = imagen.startsWith('/') ? imagen : `/${imagen}`;
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

  async centrarCaso(caso: IncidenciaMapa): Promise<void> {
    if (!this.mapaCasos) return;
    if (caso.lat_out === null || caso.lng_out === null) return;

    await this.desplazarAlMapa();
    this.mapaCasos.setView([caso.lat_out, caso.lng_out], 16);

    if (this.esVistaMovil()) {
      this.abrirModalCaso(caso);
      return;
    }

    this.capaMarcadores?.eachLayer((marcador: any) => {
      const coordenadas = marcador.getLatLng?.();
      if (!coordenadas) return;

      const mismaLatitud = coordenadas.lat === caso.lat_out;
      const mismaLongitud = coordenadas.lng === caso.lng_out;

      if (mismaLatitud && mismaLongitud) {
        marcador.openPopup?.();
      }
    });
  }
}
