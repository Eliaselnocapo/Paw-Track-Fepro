import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { HttpClientModule } from '@angular/common/http';

import { BreakpointObserver } from '@angular/cdk/layout';
import { ViewWebComponent } from './views/view-web/view-web.component';
import { ViewMovilComponent } from './views/view-movil/view-movil.component';

import { NavbarComponent } from '../../../shared/ui-layouts/navbar/navbar.component';
import { ReportService } from '../../../core/services/report.service';

declare const L: any;

interface ArchivoEvidencia {
  preview: string;
  nombre: string;
  tipo: string;
  file: File;          // ← archivo original para el FormData
}

@Component({
  selector: 'app-create-report',
  standalone: true,
  imports: [CommonModule, HttpClientModule, IonContent, ViewWebComponent, ViewMovilComponent],
  templateUrl: './create-report.page.html',
  styleUrls: ['./create-report.page.scss'],
  providers: [ReportService],
})
export class CreateReportPage implements OnInit, AfterViewInit {

  // =====================
  // ESTADO DE PASOS
  // =====================
  pasoActual: number = 1;
  esPantallaGrande: boolean = false;
  // =====================
  // ESTADO DE ENVÍO
  // =====================
  enviando: boolean = false;
  errorEnvio: string | null = null;
  folioGenerado: number | null = null;

  // =====================
  // PASO 1: ARCHIVOS
  // =====================
  archivosSeleccionados: ArchivoEvidencia[] = [];

  // =====================
  // PASO 2: DATOS ANIMAL
  // =====================
  tipoAnimal: string = '';
  tamanoAproximado: string = '';
  condicionesVisibles: string[] = [];
  notasAdicionales: string = '';

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

  constructor(
  private reportService: ReportService,
  private router: Router,
  private breakpointObserver: BreakpointObserver
  ) {
    // <-- 2. Agregas esta lógica de detección
    this.breakpointObserver.observe('(min-width: 768px)').subscribe(result => {
      this.esPantallaGrande = result.matches;
    });}

  ngOnInit(): void {}
  ngAfterViewInit(): void {}

  // =====================
  // NAVEGACIÓN
  // =====================
  siguientePaso(): void {
    if (this.pasoActual < 5) {
      this.pasoActual++;
      if (this.pasoActual === 3) setTimeout(() => this.initMapa(), 250);
      if (this.pasoActual === 4) setTimeout(() => this.initMapaPreview(), 300);
      if (this.pasoActual === 5) this.enviarReporte();
    }
  }

  regresarPaso(): void {
    if (this.pasoActual > 1) {
      if (this.pasoActual === 3) this.destruirMapa();
      this.pasoActual--;
      if (this.pasoActual === 3) setTimeout(() => this.initMapa(), 250);
    }
  }

  irAMapa(): void {
    this.destruirMapa();
    this.pasoActual = 3;
    setTimeout(() => this.initMapa(), 250);
  }

  // =====================
  // ENVÍO AL BACKEND
  // =====================
  private enviarReporte(): void {
    this.enviando = true;
    this.errorEnvio = null;

    const imagenFile = this.archivosSeleccionados.length > 0
      ? this.archivosSeleccionados[0].file
      : undefined;

    this.reportService.crearReporte({
      tipo_animal:      this.tipoAnimal,
      tamano_animal:    this.tamanoAproximado,
      condicion_animal: this.condicionesVisibles.join(','),
      notas_animal:     this.notasAdicionales,
      latitud:          this.latActual,
      longitud:         this.lngActual,
      imagen:           imagenFile,
    }).subscribe({
      next: (respuesta:any) => {
        this.enviando = false;
        this.folioGenerado = respuesta.id;
        setTimeout(() => this.lanzarConfeti(), 300);
      },
      error: (err:any) => {
        this.enviando = false;
        this.errorEnvio = 'No se pudo enviar el reporte. Intenta de nuevo.';
        console.error('Error al enviar reporte:', err);
      },
    });
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
          file: file,           // ← guardar referencia original
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
  seleccionarTipo(tipo: string): void { this.tipoAnimal = tipo; }
  seleccionarTamano(tamano: string): void { this.tamanoAproximado = tamano; }

  toggleCondicion(condicion: string): void {
    const idx = this.condicionesVisibles.indexOf(condicion);
    if (idx > -1) {
      this.condicionesVisibles.splice(idx, 1);
    } else {
      if (condicion === 'callejero' || condicion === 'extraviado') {
        this.condicionesVisibles = this.condicionesVisibles.filter(
          c => c !== 'callejero' && c !== 'extraviado'
        );
      }
      this.condicionesVisibles.push(condicion);
    }
  }

  tieneCondicion(condicion: string): boolean {
    return this.condicionesVisibles.includes(condicion);
  }

  get condicionesTexto(): string {
    if (this.condicionesVisibles.length === 0) return 'No especificada';
    const etiquetas: Record<string, string> = {
      herido: 'Herido', callejero: 'Callejero', extraviado: 'Extraviado',
    };
    return this.condicionesVisibles
      .map(c => etiquetas[c] ?? (c.charAt(0).toUpperCase() + c.slice(1)))
      .join(' + ');
  }

  // =====================
  // PASO 3: MAPA LEAFLET
  // =====================
  private initMapaPreview(): void {
    const contenedor = document.getElementById('mapa-preview');
    if (!contenedor) return;
    if (this.mapaPreview) { this.mapaPreview.remove(); this.mapaPreview = null; }

    this.mapaPreview = L.map('mapa-preview', {
      center: [this.latActual, this.lngActual], zoom: 16,
      zoomControl: false, attributionControl: false,
      dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
      .addTo(this.mapaPreview);
    L.circleMarker([this.latActual, this.lngActual], {
      radius: 10, fillColor: '#ba1a1a', color: '#ffffff', weight: 3, fillOpacity: 1,
    }).addTo(this.mapaPreview);
    setTimeout(() => this.mapaPreview?.invalidateSize(), 150);
  }

  private destruirMapa(): void {
    if (this.mapa)       { this.mapa.off(); this.mapa.remove(); this.mapa = null; }
    if (this.mapaPreview) { this.mapaPreview.remove(); this.mapaPreview = null; }
  }

  private initMapa(): void {
    const contenedor = document.getElementById('mapa-interactivo');
    if (!contenedor) return;
    this.destruirMapa();

    this.mapa = L.map('mapa-interactivo', {
      center: [this.latActual, this.lngActual], zoom: 16,
      zoomControl: false, attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
      .addTo(this.mapa);

    this.mapa.on('moveend', () => {
      const centro = this.mapa.getCenter();
      this.latActual = centro.lat;
      this.lngActual = centro.lng;
      this.reverseGeocode(centro.lat, centro.lng);
    });
    this.reverseGeocode(this.latActual, this.lngActual);
    setTimeout(() => this.mapa.invalidateSize(), 150);
  }

  private reverseGeocode(lat: number, lng: number): void {
    clearTimeout(this.geocodeTimeout);
    this.cargandoDireccion = true;
    this.geocodeTimeout = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'es' } }
      )
        .then(r => r.json())
        .then(data => {
          this.cargandoDireccion = false;
          if (!data?.address) return;
          const a = data.address;
          const calle  = a.road || a.pedestrian || a.footway || '';
          const numero = a.house_number || 'S/N';
          this.direccionActual = calle ? `${calle} ${numero}`.trim() : data.display_name?.split(',')[0] ?? 'Dirección desconocida';
          const colonia    = a.suburb || a.neighbourhood || '';
          const delegacion = a.city_district || a.borough || '';
          const ciudad     = a.city || a.town || a.village || 'Ciudad de México';
          const estado     = a.state || '';
          this.ciudadActual = [colonia, delegacion, ciudad, estado].filter(Boolean).join(', ');
        })
        .catch(() => {
          this.cargandoDireccion = false;
          this.direccionActual = 'No se pudo obtener la dirección';
        });
    }, 600);
  }

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
          }
        });
    }, 400);
  }

  // =====================
  // PASO 5: CONFETI
  // =====================
  private lanzarConfeti(): void {
    const contenedor = document.getElementById('confetti-container');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    const colores = ['#0058be', '#6cf8bb', '#ffd300', '#ff6b6b', '#a78bfa', '#ffffff', '#00714d'];
    const formas  = ['50%', '2px', '0'];
    for (let i = 0; i < 80; i++) {
      const pieza = document.createElement('div');
      pieza.style.cssText = `
        position: absolute; top: -20px;
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
}
