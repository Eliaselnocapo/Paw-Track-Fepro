import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

declare const L: any; // Leaflet global

interface ArchivoEvidencia {
  preview: string;
  nombre: string;
  tipo: string;
}

@Component({
  selector: 'app-create-report',
  standalone: true,
  imports: [CommonModule, DecimalPipe, IonContent, NavbarComponent],
  templateUrl: './create-report.page.html',
  styleUrls: ['./create-report.page.scss'],
})
export class CreateReportPage implements OnInit, AfterViewInit {

  // =====================
  // ESTADO DE PASOS
  // =====================
  pasoActual: number = 1;

  // =====================
  // PASO 1: ARCHIVOS
  // =====================
  archivosSeleccionados: ArchivoEvidencia[] = [];

  // =====================
  // PASO 2: DATOS ANIMAL
  // =====================
  tipoAnimal: string = '';
  tamanoAproximado: string = '';
  /** Multi-selección: puede tener más de una condición */
  condicionesVisibles: string[] = [];

  // =====================
  // PASO 3: MAPA
  // =====================
  private mapa: any = null;
  private mapaPreview: any = null;
  private geocodeTimeout: any = null;

  latActual: number = 19.4326;
  lngActual: number = -99.1332;
  direccionActual: string = 'Cargando dirección...';
  ciudadActual: string = '';
  cargandoDireccion: boolean = false;

  // =====================
  // PASO 5
  // =====================
  proximosPasos = [
    { id: 1, icon: 'volunteer_activism', texto: 'Un voluntario será asignado al caso' },
    { id: 2, icon: 'my_location',        texto: 'Podrás rastrear su llegada en vivo' },
    { id: 3, icon: 'notifications_active', texto: 'Te notificaremos cuando el animal esté seguro' },
  ];

  ngOnInit(): void {}
  ngAfterViewInit(): void {}

  // =====================
  // NAVEGACIÓN
  // =====================
  siguientePaso(): void {
    if (this.pasoActual < 5) {
      this.pasoActual++;
      if (this.pasoActual === 3) {
        setTimeout(() => this.initMapa(), 250);
      }
      if (this.pasoActual === 4) {
        setTimeout(() => this.initMapaPreview(), 300);
      }
      if (this.pasoActual === 5) {
        setTimeout(() => this.lanzarConfeti(), 300);
      }
    }
  }

  regresarPaso(): void {
    if (this.pasoActual > 1) {
      // Destruir mapa ANTES de salir para evitar bugs al volver
      if (this.pasoActual === 3) {
        this.destruirMapa();
      }
      this.pasoActual--;
      if (this.pasoActual === 3) {
        setTimeout(() => this.initMapa(), 250);
      }
    }
  }

  /** Navegar al mapa desde el botón EDITAR ubicación (paso 4 → 3) */
  irAMapa(): void {
    this.destruirMapa();          // limpiar instancia previa si existe
    this.pasoActual = 3;
    setTimeout(() => this.initMapa(), 250);
  }

  // =====================
  // PASO 1: CÁMARA/ARCHIVOS
  // =====================
  abrirCamara(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.capture = 'environment';
    input.onchange = (e: any) => this.procesarArchivos(e.target.files);
    input.click();
  }

  abrirGaleria(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = (e: any) => this.procesarArchivos(e.target.files);
    input.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.procesarArchivos(input.files);
  }

  private procesarArchivos(files: FileList): void {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.archivosSeleccionados.push({
          preview: e.target?.result as string,
          nombre: file.name,
          tipo: file.type,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  eliminarArchivo(archivo: ArchivoEvidencia): void {
    this.archivosSeleccionados = this.archivosSeleccionados.filter(a => a !== archivo);
  }

  // =====================
  // PASO 2: SELECCIONES
  // =====================
  seleccionarTipo(tipo: string): void {
    this.tipoAnimal = tipo;
  }

  seleccionarTamano(tamano: string): void {
    this.tamanoAproximado = tamano;
  }

  /** Toggle multi-selección — callejero y extraviado son mutuamente excluyentes */
  toggleCondicion(condicion: string): void {
    const idx = this.condicionesVisibles.indexOf(condicion);
    if (idx > -1) {
      // Ya estaba → deseleccionar
      this.condicionesVisibles.splice(idx, 1);
    } else {
      // Si es callejero o extraviado, quitar el otro antes de agregar
      if (condicion === 'callejero' || condicion === 'extraviado') {
        this.condicionesVisibles = this.condicionesVisibles.filter(
          c => c !== 'callejero' && c !== 'extraviado'
        );
      }
      this.condicionesVisibles.push(condicion);
    }
  }

  /** Verifica si una condición está seleccionada */
  tieneCondicion(condicion: string): boolean {
    return this.condicionesVisibles.includes(condicion);
  }

  /** Texto legible de condiciones seleccionadas */
  get condicionesTexto(): string {
    if (this.condicionesVisibles.length === 0) return 'No especificada';
    const etiquetas: Record<string, string> = {
      herido: 'Herido',
      callejero: 'Callejero',
      extraviado: 'Extraviado',
    };
    return this.condicionesVisibles.map(c => etiquetas[c] ?? (c.charAt(0).toUpperCase() + c.slice(1))).join(' + ');
  }

  // =====================
  // PASO 3: MAPA LEAFLET
  // =====================
  private initMapaPreview(): void {
    const contenedor = document.getElementById('mapa-preview');
    if (!contenedor) return;

    // Destruir instancia previa
    if (this.mapaPreview) {
      this.mapaPreview.remove();
      this.mapaPreview = null;
    }

    this.mapaPreview = L.map('mapa-preview', {
      center: [this.latActual, this.lngActual],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.mapaPreview);

    // Marcador circular rojo
    L.circleMarker([this.latActual, this.lngActual], {
      radius: 10,
      fillColor: '#ba1a1a',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(this.mapaPreview);

    setTimeout(() => this.mapaPreview?.invalidateSize(), 150);
  }

  private destruirMapa(): void {
    if (this.mapa) {
      this.mapa.off();
      this.mapa.remove();
      this.mapa = null;
    }
    if (this.mapaPreview) {
      this.mapaPreview.remove();
      this.mapaPreview = null;
    }
  }

  private initMapa(): void {
    const contenedor = document.getElementById('mapa-interactivo');
    if (!contenedor) return;

    // Destruir instancia previa para evitar el bug de "mapa ya inicializado"
    this.destruirMapa();

    this.mapa = L.map('mapa-interactivo', {
      center: [this.latActual, this.lngActual],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.mapa);

    // Hacer reverse geocoding al soltar el mapa (más eficiente que 'move')
    this.mapa.on('moveend', () => {
      const centro = this.mapa.getCenter();
      this.latActual = centro.lat;
      this.lngActual = centro.lng;
      this.reverseGeocode(centro.lat, centro.lng);
    });

    // Geocoding inicial al cargar
    this.reverseGeocode(this.latActual, this.lngActual);

    setTimeout(() => this.mapa.invalidateSize(), 150);
  }

  /** Reverse geocoding con Nominatim - actualiza dirección exacta */
  private reverseGeocode(lat: number, lng: number): void {
    // Debounce para no saturar la API
    clearTimeout(this.geocodeTimeout);
    this.cargandoDireccion = true;

    this.geocodeTimeout = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=es`,
        { headers: { 'Accept-Language': 'es' } }
      )
        .then(r => r.json())
        .then(data => {
          this.cargandoDireccion = false;
          if (!data || !data.address) return;

          const a = data.address;

          // Construir nombre de calle + número
          const calle  = a.road || a.pedestrian || a.footway || a.street || a.avenue || '';
          const numero = a.house_number || 'S/N';
          this.direccionActual = calle
            ? `${calle} ${numero}`.trim()
            : data.display_name?.split(',')[0] ?? 'Dirección desconocida';

          // Construir colonia + delegación + ciudad
          const colonia    = a.suburb || a.neighbourhood || a.quarter || a.residential || '';
          const delegacion = a.city_district || a.borough || '';
          const ciudad     = a.city || a.town || a.village || a.municipality || 'Ciudad de México';
          const estado     = a.state || '';

          this.ciudadActual = [colonia, delegacion, ciudad, estado]
            .filter(Boolean)
            .join(', ');
        })
        .catch(() => {
          this.cargandoDireccion = false;
          this.direccionActual = 'No se pudo obtener la dirección';
        });
    }, 600); // Esperar 600ms tras soltar el mapa
  }

  /** Búsqueda de dirección con Nominatim */
  buscarDireccion(query: string): void {
    if (!query || query.length < 3) return;
    clearTimeout(this.geocodeTimeout);
    this.geocodeTimeout = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=mx&addressdetails=1`,
        { headers: { 'Accept-Language': 'es' } }
      )
        .then(r => r.json())
        .then(results => {
          if (results.length > 0 && this.mapa) {
            const { lat, lon } = results[0];
            this.mapa.flyTo([parseFloat(lat), parseFloat(lon)], 17);
            // reverseGeocode se llamará automáticamente en el evento moveend
          }
        })
        .catch(err => console.error('Error buscando dirección:', err));
    }, 400);
  }

  // =====================
  // PASO 5: CONFETI
  // =====================
  private lanzarConfeti(): void {
    const contenedor = document.getElementById('confetti-container');
    if (!contenedor) return;
    contenedor.innerHTML = ''; // limpiar confeti previo

    const colores = ['#0058be', '#6cf8bb', '#ffd300', '#ff6b6b', '#a78bfa', '#ffffff', '#00714d'];
    const formas  = ['50%', '2px', '0'];

    for (let i = 0; i < 80; i++) {
      const pieza = document.createElement('div');
      pieza.style.cssText = `
        position: absolute;
        top: -20px;
        left: ${Math.random() * 100}%;
        width: ${6 + Math.random() * 10}px;
        height: ${8 + Math.random() * 16}px;
        background: ${colores[Math.floor(Math.random() * colores.length)]};
        border-radius: ${formas[Math.floor(Math.random() * formas.length)]};
        opacity: 1;
        animation: pawConfetti ${2.5 + Math.random() * 2.5}s ${Math.random() * 1.5}s ease-in forwards;
        --dx: ${(Math.random() - 0.5) * 200}px;
        --rot: ${Math.random() * 720 - 360}deg;
      `;
      contenedor.appendChild(pieza);
    }

    // Inyectar keyframes dinámicos si no existen
    if (!document.getElementById('paw-confetti-style')) {
      const style = document.createElement('style');
      style.id = 'paw-confetti-style';
      style.textContent = [
        '@keyframes pawConfetti {',
        '  0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }',
        '  100% { transform: translateY(110vh) translateX(var(--dx)) rotate(var(--rot)); opacity: 0; }',
        '}',
      ].join('\n');
      document.head.appendChild(style);
    }

    setTimeout(() => { contenedor.innerHTML = ''; }, 6000);
  }

    constructor(private router: Router) {}
}