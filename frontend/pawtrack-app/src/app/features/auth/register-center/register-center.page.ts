import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { CentrosAnimalesService } from '../../../core/services/centros-animales.service';
import { TipoCentro, FormaAyuda, RedesSociales } from '../../../core/models/centro-animal.model';
import { RevealDirective } from '../../../shared/directives/reveal.directive';

import * as L from 'leaflet';

@Component({
  selector: 'app-register-center',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, NavbarWebComponent, FooterWebComponent, RevealDirective],
  templateUrl: './register-center.page.html',
  styleUrls: ['./register-center.page.scss'],
})
export class RegisterCenterPage implements AfterViewInit, OnDestroy {

  pasoActual = 1;

  // Paso 1: datos básicos
  nombre = '';
  tipo: TipoCentro = 'veterinaria';
  telefono = '';
  horario = '';
  sitioWeb = '';
  descripcion = '';

  // Paso 2: perfil
  mision = '';
  vision = '';
  formasAyudaSeleccionadas: FormaAyuda[] = [];
  redesSociales: RedesSociales = {};

  bannerArchivo: File | null = null;
  bannerPreview: string | null = null;

  logoArchivo: File | null = null;
  logoPreview: string | null = null;

  readonly formasAyudaDisponibles: { valor: FormaAyuda; etiqueta: string; icono: string }[] = [
    { valor: 'dinero', etiqueta: 'Donaciones en dinero', icono: 'payments' },
    { valor: 'comida', etiqueta: 'Comida para animales', icono: 'pet_supplies' },
    { valor: 'viveres', etiqueta: 'Víveres / insumos', icono: 'inventory_2' },
    { valor: 'voluntariado', etiqueta: 'Voluntariado', icono: 'volunteer_activism' },
    { valor: 'adopciones', etiqueta: 'Adopciones', icono: 'pets' },
  ];

  // Paso 3: ubicación
  direccion = '';
  latActual = 19.0042;
  lngActual = -98.2012;

  // Paso 4 / envío
  enviando = false;
  enviado = false;
  error: string | null = null;

  private mapa: any = null;
  private marcador: any = null;

  constructor(
    private centrosService: CentrosAnimalesService,
    private router: Router,
  ) {}

  ngAfterViewInit(): void {
    // La ubicación vive en la página 1, visible desde que carga la página
    // (no al avanzar de paso, como antes) — por eso el mapa se inicializa
    // aquí directo.
    setTimeout(() => this.initMapa(), 150);
  }

  ngOnDestroy(): void {
    this.destruirMapa();
    this.quitarBanner();
    this.quitarLogo();
  }

  // ─────────────────────────────────────────
  // Navegación entre pasos
  // ─────────────────────────────────────────

  siguientePaso(): void {
    if (this.pasoActual >= 2) return;
    if (!this.paso1Valido()) return;

    this.pasoActual++;
  }

  regresarPaso(): void {
    if (this.pasoActual <= 1) return;
    this.pasoActual--;
  }

  // ─────────────────────────────────────────
  // Mapa (paso 3)
  // ─────────────────────────────────────────

  initMapa(): void {
    if (this.mapa) return;

    const contenedor = document.getElementById('mapa-registro-centro');
    if (!contenedor) return;

    this.mapa = L.map('mapa-registro-centro').setView([this.latActual, this.lngActual], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.mapa);

    this.marcador = L.marker([this.latActual, this.lngActual], { draggable: true }).addTo(this.mapa);

    this.marcador.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      this.latActual = pos.lat;
      this.lngActual = pos.lng;
      this.obtenerDireccionDesdeCoordenadas(pos.lat, pos.lng);
    });

    this.mapa.on('click', (e: any) => {
      this.marcador.setLatLng(e.latlng);
      this.latActual = e.latlng.lat;
      this.lngActual = e.latlng.lng;
      this.obtenerDireccionDesdeCoordenadas(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => this.mapa?.invalidateSize(), 150);

    // Llenar la dirección también para la posición inicial del pin — si
    // no, la ubicación queda vacía hasta que el usuario mueva el mapa,
    // y el formulario no se puede enviar sin dirección.
    this.obtenerDireccionDesdeCoordenadas(this.latActual, this.lngActual);
  }

  /**
   * Convierte lat/lng en una dirección legible (geocodificación inversa).
   * Se usa tanto al hacer clic/arrastrar el pin como al cargar el mapa
   * por primera vez — antes SOLO se llenaba la dirección al buscar por
   * texto, dejando "direccion" vacía si el usuario solo movía el pin.
   */
  private obtenerDireccionDesdeCoordenadas(lat: number, lng: number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.display_name) {
          this.direccion = data.display_name;
        }
      })
      .catch(() => {
        // Si falla la geocodificación inversa, no bloqueamos la interacción
        // del mapa — el usuario puede seguir intentando o usar la búsqueda.
      });
  }

  buscarDireccion(query: string): void {
    if (!query || query.trim().length < 3) return;

    const q = encodeURIComponent(query + ', Puebla');

    fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;

        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        this.latActual = lat;
        this.lngActual = lng;
        this.direccion = data[0].display_name ?? query;

        if (this.mapa && this.marcador) {
          this.mapa.setView([lat, lng], 16);
          this.marcador.setLatLng([lat, lng]);
        }
      })
      .catch(() => {});
  }

  private destruirMapa(): void {
    if (this.mapa) {
      this.mapa.remove();
      this.mapa = null;
      this.marcador = null;
    }
  }

  // ─────────────────────────────────────────
  // Perfil: banner / logo / formas de ayudar
  // ─────────────────────────────────────────

  toggleFormaAyuda(valor: FormaAyuda): void {
    const idx = this.formasAyudaSeleccionadas.indexOf(valor);
    if (idx > -1) {
      this.formasAyudaSeleccionadas.splice(idx, 1);
    } else {
      this.formasAyudaSeleccionadas.push(valor);
    }
  }

  tieneFormaAyuda(valor: FormaAyuda): boolean {
    return this.formasAyudaSeleccionadas.includes(valor);
  }

  onBannerSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.bannerArchivo = file;
    this.bannerPreview = URL.createObjectURL(file);
  }

  onLogoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.logoArchivo = file;
    this.logoPreview = URL.createObjectURL(file);
  }

  quitarBanner(): void {
    if (this.bannerPreview) URL.revokeObjectURL(this.bannerPreview);
    this.bannerArchivo = null;
    this.bannerPreview = null;
  }

  quitarLogo(): void {
    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoArchivo = null;
    this.logoPreview = null;
  }

  // ─────────────────────────────────────────
  // Validación
  // ─────────────────────────────────────────

  telefonoValido(): boolean {
    return /^\d{10}$/.test(this.telefono.trim());
  }

  paso1Valido(): boolean {
    return this.nombre.trim().length >= 3 && !!this.tipo && this.telefonoValido();
  }

  formularioValido(): boolean {
    return this.paso1Valido() && this.direccion.trim().length >= 5;
  }

  private tieneAlgunaRedSocial(): boolean {
    return Object.values(this.redesSociales).some((v) => !!v?.trim());
  }

  // ─────────────────────────────────────────
  // Envío
  // ─────────────────────────────────────────

  enviar(): void {
    if (!this.formularioValido() || this.enviando) return;

    this.enviando = true;
    this.error = null;

    this.centrosService
      .registrarCentro({
        nombre: this.nombre.trim(),
        tipo: this.tipo,
        direccion: this.direccion.trim(),
        latitud: this.latActual,
        longitud: this.lngActual,
        telefono: this.telefono.trim(),
        horario: this.horario.trim() || undefined,
        sitioWeb: this.sitioWeb.trim() || undefined,
        descripcion: this.descripcion.trim() || undefined,

        banner: this.bannerArchivo,
        logo: this.logoArchivo,
        mision: this.mision.trim() || undefined,
        vision: this.vision.trim() || undefined,
        formasAyuda: this.formasAyudaSeleccionadas.length ? this.formasAyudaSeleccionadas : undefined,
        redesSociales: this.tieneAlgunaRedSocial() ? this.redesSociales : undefined,
      })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.enviado = true;
        },
        error: (err) => {
          this.enviando = false;
          this.error =
            err?.error?.detail ??
            'No se pudo enviar tu solicitud. Intenta de nuevo.';
        },
      });
  }

  volver(): void {
    this.router.navigate(['/patrocinadores']);
  }
}