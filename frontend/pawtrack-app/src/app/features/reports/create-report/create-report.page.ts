import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService } from '../../../core/services/report.service';

declare let L: any;

@Component({
  selector: 'app-create-report',
  templateUrl: './create-report.page.html',
  styleUrls: ['./create-report.page.scss'],
  imports: [
    CommonModule,
    DecimalPipe,
    FormsModule,
    NavbarWebComponent,
    FooterWebComponent
  ],
  standalone: true,
})
export class CreateReportPage implements OnInit, AfterViewInit {

  pasoActual: number = 1;

  tipoAnimal: string = '';
  tamanoAproximado: string = '';
  condicionesVisibles: string[] = [];
  condicionesTexto: string = 'Ninguna';
  notasAdicionales: string = '';

  archivosSeleccionados: { archivoFisico: File, preview: string, nombre: string }[] = [];

  // Datos de contacto del usuario
  nombreUsuario: string = '';
  telefonoUsuario: string = '';

  // Datos de ubicación
  direccionActual: string = 'Av. San Manuel, Puebla (Cerca de CU)';
  ciudadActual: string = 'Puebla, México';
  latActual: number = 19.0042;
  lngActual: number = -98.2012;
  cargandoDireccion: boolean = false;

  folioGenerado: string | null = null;
  enviando = false;
  errorEnvio: string | null = null;

  // Instancias de Leaflet
  private mapInteractive: any;
  private markerInteractive: any;
  private mapPreview: any;
  private markerPreview: any;

  proximosPasos = [
    { id: 1, texto: 'Los rescatistas cercanos reciben una alerta de alta prioridad.' },
    { id: 2, texto: 'Un voluntario acepta el caso y se dirige a la ubicación exacta.' },
    { id: 3, texto: 'El animal es trasladado a una veterinaria o refugio asociado.' }
  ];

  constructor(private cdr: ChangeDetectorRef, private reportService: ReportService) {}

  ngOnInit() {}

  ngAfterViewInit() {}

  // === INICIALIZACIÓN DE MAPA INTERACTIVO (PASO 3) ===
  initInteractiveMap() {
    if (this.mapInteractive) return;

    setTimeout(() => {
      this.mapInteractive = L.map('mapa-interactivo').setView([this.latActual, this.lngActual], 16);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.mapInteractive);

      this.markerInteractive = L.marker([this.latActual, this.lngActual], { draggable: true }).addTo(this.mapInteractive);

      this.markerInteractive.on('dragend', (e: any) => {
        const position = e.target.getLatLng();
        this.actualizarCoordenadas(position.lat, position.lng);
        this.mapInteractive.panTo(position);
        this.obtenerDireccionDesdeCoordenadas(position.lat, position.lng);
      });

      this.mapInteractive.on('click', (e: any) => {
        const position = e.latlng;
        this.markerInteractive.setLatLng(position);
        this.mapInteractive.panTo(position);
        this.actualizarCoordenadas(position.lat, position.lng);
        this.obtenerDireccionDesdeCoordenadas(position.lat, position.lng);
      });
    }, 300);
  }

  // === INICIALIZACIÓN DE MAPA PREVIEW (PASO 4) ===
  initPreviewMap() {
    if (this.mapPreview) return;

    setTimeout(() => {
      this.mapPreview = L.map('mapa-preview', { zoomControl: false }).setView([this.latActual, this.lngActual], 16);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.mapPreview);

      this.markerPreview = L.marker([this.latActual, this.lngActual]).addTo(this.mapPreview);
    }, 300);
  }

  actualizarCoordenadas(lat: number, lng: number) {
    this.latActual = lat;
    this.lngActual = lng;
  }

  // === GESTIÓN DE UBICACIÓN (NOMINATIM / OPENSTREETMAP) ===
  buscarDireccion(direccion: string) {
    if (!direccion || direccion.trim().length < 3) return;

    this.cargandoDireccion = true;
    const query = encodeURIComponent(direccion + ', Puebla');
    
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
      .then(response => response.json())
      .then(data => {
        this.cargandoDireccion = false;
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          
          this.direccionActual = data[0].display_name.split(',')[0] || direccion;
          this.ciudadActual = 'Puebla, México'; 
          
          this.actualizarCoordenadas(lat, lng);
          if (this.markerInteractive) {
            const newLatLng = new L.LatLng(lat, lng);
            this.markerInteractive.setLatLng(newLatLng);
            this.mapInteractive.setView(newLatLng, 16);
          }
          this.cdr.detectChanges();
        }
      })
      .catch(() => {
        this.cargandoDireccion = false;
        this.cdr.detectChanges();
      });
  }

  obtenerDireccionDesdeCoordenadas(lat: number, lng: number) {
    this.cargandoDireccion = true;
    
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
      .then(response => response.json())
      .then(data => {
        this.cargandoDireccion = false;
        if (data && data.address) {
          const road = data.address.road || '';
          const houseNumber = data.address.house_number ? ` #${data.address.house_number}` : '';
          const suburb = data.address.suburb || '';
          
          if (road) {
            this.direccionActual = `${road}${houseNumber}${suburb ? ', ' + suburb : ''}`;
          } else {
            this.direccionActual = data.display_name ? data.display_name.split(',')[0] : 'Ubicación exacta';
          }
          
          this.ciudadActual = data.address.city || data.address.town || data.address.state || 'Puebla, México';
        }
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.cargandoDireccion = false;
        this.direccionActual = 'Ubicación ajustada en el mapa';
        this.cdr.detectChanges();
      });
  }

  // === MÉTODOS DESTRUCTORES DE MAPA (EVITA PANTALLA GRIS) ===
  destroyInteractiveMap() {
    if (this.mapInteractive) {
      this.mapInteractive.remove();
      this.mapInteractive = null;
      this.markerInteractive = null;
    }
  }

  destroyPreviewMap() {
    if (this.mapPreview) {
      this.mapPreview.remove();
      this.mapPreview = null;
      this.markerPreview = null;
    }
  }

  // === FLUJO DE NAVEGACIÓN ===
  siguientePaso() {
    if (this.pasoActual < 5) {
      if (this.pasoActual === 3) this.destroyInteractiveMap();
      if (this.pasoActual === 4) this.destroyPreviewMap();

      this.pasoActual++;

      if (this.pasoActual === 3) this.initInteractiveMap();
      if (this.pasoActual === 4) this.initPreviewMap();
      if (this.pasoActual === 5) this.guardarBaseDatosLocal(); // Corregido el nombre aquí
    }
  }

  regresarPaso() {
    if (this.pasoActual > 1) {
      if (this.pasoActual === 3) this.destroyInteractiveMap();
      if (this.pasoActual === 4) this.destroyPreviewMap();
      
      this.pasoActual--;
      
      if (this.pasoActual === 3) this.initInteractiveMap();
    }
  }

  guardarBaseDatosLocal() {
    this.guardarEnBaseDeDatos();
  }

  seleccionarTipo(tipo: string) { this.tipoAnimal = tipo; }
  seleccionarTamano(tamano: string) { this.tamanoAproximado = tamano; }
  
  toggleCondicion(condicion: string) {
    const index = this.condicionesVisibles.indexOf(condicion);
    if (index > -1) this.condicionesVisibles.splice(index, 1);
    else this.condicionesVisibles.push(condicion);

    this.condicionesTexto = this.condicionesVisibles.length > 0 
      ? this.condicionesVisibles.join(', ') 
      : 'Ninguna';
  }

  tieneCondicion(condicion: string): boolean {
    return this.condicionesVisibles.includes(condicion);
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: any) => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.archivosSeleccionados.push({
            archivoFisico: file,
            preview: e.target.result,
            nombre: file.name
          });
        };
        reader.readAsDataURL(file);
      });
    }
  }

  eliminarArchivo(archivo: any) {
    const index = this.archivosSeleccionados.indexOf(archivo);
    if (index > -1) this.archivosSeleccionados.splice(index, 1);
  }

  guardarEnBaseDeDatos() {
    this.enviando    = true;
    this.errorEnvio  = null;

    this.reportService.crearReporte({
      tipo_animal:      this.tipoAnimal,
      tamano_animal:    this.tamanoAproximado,
      condicion_animal: this.condicionesTexto,
      notas_animal:     this.notasAdicionales,
      latitud:          this.latActual,
      longitud:         this.lngActual,
      imagen:           this.archivosSeleccionados[0]?.archivoFisico,
    }).subscribe({
      next: (res) => {
        this.folioGenerado = res.folio ?? `#${res.id}`;
        this.enviando      = false;
        this.destroyPreviewMap();
      },
      error: () => {
        this.errorEnvio = 'No se pudo enviar el reporte. Intenta de nuevo.';
        this.enviando   = false;
        // Regresa al paso anterior para que el usuario pueda reintentar
        this.pasoActual = 4;
      },
    });
  }

  irAMapa() {
    this.destroyPreviewMap(); // Limpiamos preview si estábamos en paso 4
    this.pasoActual = 3;
    this.initInteractiveMap();
  }
}