import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  HostListener,
  inject,
  NgZone,
  OnDestroy,
  OnInit
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonModal,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';

import { firstValueFrom } from 'rxjs';

import {
  CentroAnimal,
  UbicacionUsuario
} from '../../core/models/centro-animal.model';

import {
  CentrosAnimalesService
} from '../../core/services/centros-animales.service';

import {
  NavbarWebComponent
} from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';

import {
  FooterWebComponent
} from '../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

declare let L: any;

@Component({
  selector: 'app-patrocinadores',
  templateUrl: './patrocinadores.page.html',
  styleUrls: ['./patrocinadores.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,

    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonModal,

    NavbarWebComponent,
    FooterWebComponent
  ]
})
export class PatrocinadoresPage
  implements OnInit, AfterViewInit, OnDestroy {

  private readonly centrosService =
    inject(CentrosAnimalesService);

  private readonly ngZone =
    inject(NgZone);

  private mapaEscritorio: any = null;
  private capaMarcadoresEscritorio: any = null;

  private mapaModal: any = null;

  private readonly marcadoresCentros =
    new Map<string, any>();

  readonly radiosBusquedaKm = [
    5,
    10,
    20,
    30,
    50
  ];

  ubicacionUsuario?: UbicacionUsuario;

  centros: CentroAnimal[] = [];

  centroSeleccionado: CentroAnimal | null = null;

  modalMapaAbierto = false;

  indiceRadioActual = 0;

  cargandoUbicacion = false;
  cargandoCentros = false;

  error = '';

  ngOnInit(): void {
    void this.inicializarBusqueda();
  }

  ngAfterViewInit(): void {
    this.programarMapaEscritorio();
  }

  ionViewDidEnter(): void {
    this.programarMapaEscritorio();
  }

  ngOnDestroy(): void {
    this.destruirMapaEscritorio();
    this.destruirMapaModal();
  }

  @HostListener('window:resize')
  manejarCambioDeTamano(): void {
    if (!this.esVistaMovil()) {
      this.programarMapaEscritorio();
    }
  }

  get radioActualKm(): number {
    return this.radiosBusquedaKm[
      this.indiceRadioActual
    ];
  }

  get siguienteRadioKm(): number | null {
    return this.radiosBusquedaKm[
      this.indiceRadioActual + 1
    ] ?? null;
  }

  get puedeMostrarMas(): boolean {
    return this.siguienteRadioKm !== null;
  }

  async inicializarBusqueda(): Promise<void> {
    this.error = '';
    this.centros = [];
    this.indiceRadioActual = 0;
    this.cargandoUbicacion = true;

    try {
      this.ubicacionUsuario =
        await this.centrosService
          .obtenerUbicacionUsuario();

      await this.buscarCentros();
    } catch (error) {
      this.error =
        this.obtenerMensajeError(error);
    } finally {
      this.cargandoUbicacion = false;

      this.programarMapaEscritorio();
    }
  }

  async buscarCentros(): Promise<void> {
    if (!this.ubicacionUsuario) {
      this.error =
        'No se cuenta con la ubicación del usuario.';

      return;
    }

    this.error = '';
    this.cargandoCentros = true;

    try {
      this.centros = await firstValueFrom(
        this.centrosService.buscarRefugios(
          this.ubicacionUsuario,
          this.radioActualKm
        )
      );

      this.programarMapaEscritorio();
    } catch (error) {
      console.error(
        'Error al buscar refugios:',
        error
      );

      this.error =
        'No fue posible buscar refugios cercanos.';
    } finally {
      this.cargandoCentros = false;
    }
  }

  async mostrarMas(): Promise<void> {
    if (
      !this.puedeMostrarMas ||
      this.cargandoCentros
    ) {
      return;
    }

    this.indiceRadioActual++;

    await this.buscarCentros();
  }

  reintentar(): void {
    void this.inicializarBusqueda();
  }

  verEnMapa(centro: CentroAnimal): void {
    this.centroSeleccionado = centro;

    if (this.esVistaMovil()) {
      this.modalMapaAbierto = true;

      return;
    }

    this.programarMapaEscritorio(centro);
  }

  cerrarMapaModal(): void {
    this.modalMapaAbierto = false;
  }

  mapaModalPresentado(): void {
    requestAnimationFrame(() => {
      this.inicializarMapaModal();
    });
  }

  mapaModalCerrado(): void {
    this.modalMapaAbierto = false;

    this.destruirMapaModal();

    this.centroSeleccionado = null;
  }

  private programarMapaEscritorio(
    centro?: CentroAnimal
  ): void {
    if (this.esVistaMovil()) {
      return;
    }

    requestAnimationFrame(() => {
      this.inicializarMapaEscritorio();
      this.actualizarMapaEscritorio();

      if (centro) {
        this.centrarCentroEnEscritorio(centro);
      }
    });
  }

  private inicializarMapaEscritorio(): void {
    if (typeof L === 'undefined') {
      console.error(
        'Leaflet no está cargado en el proyecto.'
      );

      return;
    }

    if (this.mapaEscritorio) {
      this.mapaEscritorio.invalidateSize();

      return;
    }

    const contenedor =
      document.getElementById(
        'mapa-refugios-escritorio'
      );

    if (!contenedor) {
      return;
    }

    const coordenadasIniciales:
      [number, number] =
      this.ubicacionUsuario
        ? [
            this.ubicacionUsuario.latitud,
            this.ubicacionUsuario.longitud
          ]
        : [
            19.0042,
            -98.2012
          ];

    this.mapaEscritorio = L.map(
      'mapa-refugios-escritorio',
      {
        zoomControl: true,
        attributionControl: true
      }
    ).setView(
      coordenadasIniciales,
      13
    );

    this.agregarCapaBase(
      this.mapaEscritorio
    );

    this.capaMarcadoresEscritorio =
      L.layerGroup().addTo(
        this.mapaEscritorio
      );

    requestAnimationFrame(() => {
      this.mapaEscritorio?.invalidateSize();
    });
  }

  private actualizarMapaEscritorio(): void {
    if (
      !this.mapaEscritorio ||
      !this.capaMarcadoresEscritorio
    ) {
      return;
    }

    this.capaMarcadoresEscritorio
      .clearLayers();

    this.marcadoresCentros.clear();

    const puntos: [number, number][] = [];

    if (this.ubicacionUsuario) {
      const coordenadasUsuario:
        [number, number] = [
          this.ubicacionUsuario.latitud,
          this.ubicacionUsuario.longitud
        ];

      const marcadorUsuario =
        L.circleMarker(
          coordenadasUsuario,
          {
            radius: 9,
            color: '#ffffff',
            weight: 3,
            fillColor: '#14b8a6',
            fillOpacity: 1
          }
        )
          .bindTooltip('Tu ubicación')
          .addTo(
            this.capaMarcadoresEscritorio
          );

      marcadorUsuario.bringToFront();

      puntos.push(coordenadasUsuario);
    }

    this.centros.forEach(centro => {
      const coordenadasCentro:
        [number, number] = [
          centro.latitud,
          centro.longitud
        ];

      const marcador =
        L.circleMarker(
          coordenadasCentro,
          {
            radius: 10,
            color: '#ffffff',
            weight: 3,
            fillColor: '#2563eb',
            fillOpacity: 1
          }
        )
          .bindPopup(
            this.crearPopupCentro(centro),
            {
              maxWidth: 280,
              minWidth: 210
            }
          )
          .addTo(
            this.capaMarcadoresEscritorio
          );

      marcador.on('click', () => {
        this.ngZone.run(() => {
          this.centroSeleccionado = centro;
        });
      });

      this.marcadoresCentros.set(
        centro.id,
        marcador
      );

      puntos.push(coordenadasCentro);
    });

    if (puntos.length > 1) {
      this.mapaEscritorio.fitBounds(
        puntos,
        {
          padding: [38, 38],
          maxZoom: 14
        }
      );
    } else if (puntos.length === 1) {
      this.mapaEscritorio.setView(
        puntos[0],
        14
      );
    }

    requestAnimationFrame(() => {
      this.mapaEscritorio?.invalidateSize();
    });
  }

  private centrarCentroEnEscritorio(
    centro: CentroAnimal
  ): void {
    if (!this.mapaEscritorio) {
      return;
    }

    this.mapaEscritorio.flyTo(
      [
        centro.latitud,
        centro.longitud
      ],
      16,
      {
        animate: true,
        duration: 0.7
      }
    );

    const marcador =
      this.marcadoresCentros.get(
        centro.id
      );

    marcador?.openPopup();
  }

  private inicializarMapaModal(): void {
    if (
      !this.centroSeleccionado ||
      typeof L === 'undefined'
    ) {
      return;
    }

    this.destruirMapaModal();

    const contenedor =
      document.getElementById(
        'mapa-refugio-modal'
      );

    if (!contenedor) {
      return;
    }

    const centro =
      this.centroSeleccionado;

    const coordenadasCentro:
      [number, number] = [
        centro.latitud,
        centro.longitud
      ];

    this.mapaModal = L.map(
      'mapa-refugio-modal',
      {
        zoomControl: true,
        attributionControl: true
      }
    ).setView(
      coordenadasCentro,
      15
    );

    this.agregarCapaBase(
      this.mapaModal
    );

    L.circleMarker(
      coordenadasCentro,
      {
        radius: 11,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1
      }
    )
      .bindPopup(
        this.crearPopupCentro(centro)
      )
      .addTo(this.mapaModal)
      .openPopup();

    if (this.ubicacionUsuario) {
      const coordenadasUsuario:
        [number, number] = [
          this.ubicacionUsuario.latitud,
          this.ubicacionUsuario.longitud
        ];

      L.circleMarker(
        coordenadasUsuario,
        {
          radius: 9,
          color: '#ffffff',
          weight: 3,
          fillColor: '#14b8a6',
          fillOpacity: 1
        }
      )
        .bindTooltip('Tu ubicación')
        .addTo(this.mapaModal);

      this.mapaModal.fitBounds(
        [
          coordenadasUsuario,
          coordenadasCentro
        ],
        {
          padding: [35, 35],
          maxZoom: 15
        }
      );
    }

    requestAnimationFrame(() => {
      this.mapaModal?.invalidateSize();
    });
  }

  private agregarCapaBase(
    mapa: any
  ): void {
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }
    ).addTo(mapa);
  }

  private crearPopupCentro(
    centro: CentroAnimal
  ): HTMLElement {
    const contenedor =
      document.createElement('div');

    contenedor.style.minWidth = '190px';
    contenedor.style.padding = '2px';

    const titulo =
      document.createElement('strong');

    titulo.textContent = centro.nombre;
    titulo.style.display = 'block';
    titulo.style.marginBottom = '5px';
    titulo.style.fontSize = '14px';
    titulo.style.color = '#0f172a';

    const distancia =
      document.createElement('span');

    distancia.textContent =
      `${centro.distanciaKm} km de distancia`;

    distancia.style.display = 'block';
    distancia.style.marginBottom = '5px';
    distancia.style.fontSize = '12px';
    distancia.style.fontWeight = '700';
    distancia.style.color = '#2563eb';

    contenedor.appendChild(titulo);
    contenedor.appendChild(distancia);

    if (centro.direccion) {
      const direccion =
        document.createElement('span');

      direccion.textContent =
        centro.direccion;

      direccion.style.display = 'block';
      direccion.style.fontSize = '12px';
      direccion.style.lineHeight = '1.4';
      direccion.style.color = '#64748b';

      contenedor.appendChild(direccion);
    }

    return contenedor;
  }

  private destruirMapaEscritorio(): void {
    if (!this.mapaEscritorio) {
      return;
    }

    this.mapaEscritorio.remove();
    this.mapaEscritorio = null;

    this.capaMarcadoresEscritorio = null;

    this.marcadoresCentros.clear();
  }

  private destruirMapaModal(): void {
    if (!this.mapaModal) {
      return;
    }

    this.mapaModal.remove();
    this.mapaModal = null;
  }

  private esVistaMovil(): boolean {
    return window.matchMedia(
      '(max-width: 1023px)'
    ).matches;
  }

  private obtenerMensajeError(
    error: unknown
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Ocurrió un error inesperado.';
  }
}
