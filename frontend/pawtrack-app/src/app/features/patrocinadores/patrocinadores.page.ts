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
import { Router, RouterLink } from '@angular/router';

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
import { RevealDirective } from '../../../../src/app/shared/directives/reveal.directive';

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

import { FormsModule } from '@angular/forms';
import { SentenceCasePipe } from '../../shared/pipes/sentence-case-pipe';

declare let L: any;

@Component({
  selector: 'app-patrocinadores',
  templateUrl: './patrocinadores.page.html',
  styleUrls: ['./patrocinadores.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,

    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonModal,

    NavbarWebComponent,
    FooterWebComponent,
    SentenceCasePipe,
    RevealDirective
  ]
})
export class PatrocinadoresPage
  implements OnInit, AfterViewInit, OnDestroy {

  private readonly centrosService =
    inject(CentrosAnimalesService);

  private readonly ngZone =
    inject(NgZone);

  private readonly router =
    inject(Router);

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
  paginaActual = 1;
  private readonly POR_PAGINA = 3;

  centroSeleccionado: CentroAnimal | null = null;

  modalMapaAbierto = false;

  indiceRadioActual = 0;

  cargandoUbicacion = false;
  cargandoCentros = false;

  filtroNombre = '';

  yaTieneCentro: boolean | undefined = undefined;

  error = '';

  ngOnInit(): void {
    void this.inicializarBusqueda();
    this.verificarMiCentro();
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

get centrosVisibles(): CentroAnimal[] {
    return this.centrosFiltrados;
  }

  get centrosFiltrados(): CentroAnimal[] {
    const q = this.filtroNombre.trim().toLowerCase();
    if (!q) return this.centros;
    return this.centros.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      (c.direccion ?? '').toLowerCase().includes(q)
    );
  }
  

  get totalPaginas(): number {
    return Math.ceil(this.centros.length / this.POR_PAGINA) || 1;
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  get inicioRango(): number {
    return (this.paginaActual - 1) * this.POR_PAGINA + 1;
  }

  get finRango(): number {
    return Math.min(this.paginaActual * this.POR_PAGINA, this.centros.length);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
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
    this.paginaActual = 1;
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
        this.centrosService.buscarTodosLosCentros(
          this.ubicacionUsuario,
          this.radioActualKm
        )
      );
      this.paginaActual = 1;

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
  
  get haySesion(): boolean {
    return !!localStorage.getItem('pawtrack_access');
  }

  private verificarMiCentro(): void {
    // Sin sesión no tiene sentido preguntar — misSolicitudesCentro() daría 401.
    if (!localStorage.getItem('pawtrack_access')) {
      this.yaTieneCentro = false;
      return;
    }

    this.centrosService.misSolicitudesCentro().subscribe({
      next: (solicitudes) => {
        this.yaTieneCentro = solicitudes.length > 0;
      },
      error: () => {
        // Si falla la consulta, no bloqueamos la pantalla — solo asumimos
        // que no tiene centro y dejamos el CTA de registro por defecto.
        this.yaTieneCentro = false;
      },
    });
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

  estaAbierto(centro: CentroAnimal): boolean | null {
    if (!centro.horario) return null;
    if (/24\/7/.test(centro.horario)) return true;

    const m = centro.horario.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;

    const ahora = new Date();
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    const desde = +m[1] * 60 + +m[2];
    const hasta = +m[3] * 60 + +m[4];

    return minutos >= desde && minutos <= hasta;
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
            radius: centro.verificado ? 11 : 9,
            color: '#ffffff',
            weight: 3,
            fillColor: centro.verificado ? '#2563eb' : '#94a3b8',
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
        radius: centro.verificado ? 12 : 10,
        color: '#ffffff',
        weight: 3,
        fillColor: centro.verificado ? '#2563eb' : '#94a3b8',
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
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '&copy; OpenStreetMap contributors' }
  ).addTo(mapa);}

  private crearPopupCentro(
    centro: CentroAnimal
  ): HTMLElement {
    if (centro.verificado) {
      return this.crearPopupCentroVerificado(centro);
    }

    // Sin verificar (OpenStreetMap): popup simple, como ya estaba.
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
    distancia.style.color = '#64748b';

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

    const sinVerificar =
      document.createElement('span');

    sinVerificar.textContent = 'Sin verificar por PawTrack';
    sinVerificar.style.display = 'block';
    sinVerificar.style.marginTop = '6px';
    sinVerificar.style.fontSize = '10px';
    sinVerificar.style.fontWeight = '700';
    sinVerificar.style.textTransform = 'uppercase';
    sinVerificar.style.color = '#94a3b8';

    contenedor.appendChild(sinVerificar);

    return contenedor;
  }

  /**
   * Popup enriquecido para centros verificados — misma info clave que
   * ves al registrar tu perfil (tipo, contacto), más un link directo
   * a la página de perfil público completa.
   */
  private crearPopupCentroVerificado(
    centro: CentroAnimal
  ): HTMLElement {
    const contenedor = document.createElement('div');
    contenedor.style.minWidth = '220px';
    contenedor.style.padding = '2px';
    contenedor.style.fontFamily = 'inherit';

    // Badge "Verificado"
    const badge = document.createElement('div');
    badge.textContent = '✓ Verificado';
    badge.style.display = 'inline-block';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = '800';
    badge.style.textTransform = 'uppercase';
    badge.style.letterSpacing = '0.02em';
    badge.style.color = '#059669';
    badge.style.background = '#ecfdf5';
    badge.style.padding = '2px 8px';
    badge.style.borderRadius = '999px';
    badge.style.marginBottom = '6px';
    contenedor.appendChild(badge);

    // Nombre
    const titulo = document.createElement('strong');
    titulo.textContent = centro.nombre;
    titulo.style.display = 'block';
    titulo.style.fontSize = '14px';
    titulo.style.color = '#0f172a';
    titulo.style.marginBottom = '3px';
    contenedor.appendChild(titulo);

    // Tipo (veterinaria / refugio)
    const tipo = document.createElement('span');
    tipo.textContent = centro.tipo === 'veterinaria' ? '🏥 Veterinaria' : '🐾 Refugio';
    tipo.style.display = 'block';
    tipo.style.fontSize = '12px';
    tipo.style.fontWeight = '700';
    tipo.style.color = '#2563eb';
    tipo.style.marginBottom = '6px';
    contenedor.appendChild(tipo);

    // Teléfono
    if (centro.telefono) {
      const telefono = document.createElement('span');
      telefono.textContent = `📞 ${centro.telefono}`;
      telefono.style.display = 'block';
      telefono.style.fontSize = '12px';
      telefono.style.color = '#334155';
      telefono.style.marginBottom = '3px';
      contenedor.appendChild(telefono);
    }

    // Dirección
    if (centro.direccion) {
      const direccion = document.createElement('span');
      direccion.textContent = centro.direccion;
      direccion.style.display = 'block';
      direccion.style.fontSize = '12px';
      direccion.style.lineHeight = '1.4';
      direccion.style.color = '#64748b';
      direccion.style.marginBottom = '8px';
      contenedor.appendChild(direccion);
    }

    // Botón "Ver perfil completo"
    const boton = document.createElement('button');
    boton.textContent = 'Ver perfil completo →';
    boton.style.width = '100%';
    boton.style.background = '#1d4ed8';
    boton.style.color = '#ffffff';
    boton.style.fontSize = '12px';
    boton.style.fontWeight = '700';
    boton.style.border = 'none';
    boton.style.borderRadius = '6px';
    boton.style.padding = '7px 10px';
    boton.style.cursor = 'pointer';

    boton.addEventListener('click', () => {
      this.ngZone.run(() => {
        // El id de un centro verificado viene como "verificado-{id}" desde
        // buscarCentrosVerificados() — se le quita el prefijo para navegar.
        const idNumerico = centro.id.replace('verificado-', '');
        this.router.navigate(['/centro', idNumerico]);
      });
    });

    contenedor.appendChild(boton);

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