import {
  Component,
  HostListener,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, TitleCasePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';

declare let L: any;

type TipoAnimal = '' | 'perro' | 'gato';
type TamanoAnimal = '' | 'cachorro' | 'pequeño' | 'mediano' | 'grande' | 'adulto';
type CondicionAnimal = 'herido' | 'callejero' | 'extraviado';

interface EditReportViewModel {
  folio: string;
  nombreCaso: string;
  estado: string;
  tipoAnimal: TipoAnimal;
  tamanoAnimal: TamanoAnimal;
  condicionesVisibles: CondicionAnimal[];
  notasAnimal: string;
  caracteristicas: string;
  edadEstimada: string;
  pesoEstimado: string;
  lat: number | null;
  lng: number | null;
  ubicacionTexto: string;
  nombreContacto: string;
  telefonoContacto: string;
}

interface CambioAplicado {
  campo: string;
  antes: string;
  ahora: string;
}

@Component({
  selector: 'app-update-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
    TitleCasePipe,
    DecimalPipe,
  ],
  templateUrl: './update-report.page.html',
  styleUrls: ['./update-report.page.scss'],
})
export class UpdateReportPage implements OnInit, AfterViewInit {
  esPantallaGrande = window.innerWidth >= 768;

  private reporteNumericId!: number;
  private mapInteractive: any;
  private markerInteractive: any;

  cargando = true;
  guardando = false;
  error: string | null = null;
  mensajeExito: string | null = null;

  cargandoDireccion = false;

  imagenNueva: File | null = null;
  imagenPreview: string | null = null;

  reporteOriginal: EditReportViewModel | null = null;

  reporte: EditReportViewModel = {
    folio: '',
    nombreCaso: '',
    estado: '',
    tipoAnimal: '',
    tamanoAnimal: '',
    condicionesVisibles: [],
    notasAnimal: '',
    caracteristicas: '',
    edadEstimada: '',
    pesoEstimado: '',
    lat: null,
    lng: null,
    ubicacionTexto: '',
    nombreContacto: '',
    telefonoContacto: '',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const folio = this.route.snapshot.paramMap.get('folio');

    if (!folio) {
      this.error = 'No se recibió un folio válido.';
      this.cargando = false;
      return;
    }

    this.reportService.obtenerReportePorFolio(folio).subscribe({
      next: (data) => this.poblarFormulario(data),
      error: () => {
        this.error = 'No se pudo cargar el reporte. Verifica que el folio sea correcto.';
        this.cargando = false;
      },
    });
  }

  ngAfterViewInit(): void {}

  @HostListener('window:resize')
  onResize(): void {
    this.esPantallaGrande = window.innerWidth >= 768;
  }

  private poblarFormulario(data: IncidenciaResponse): void {
    this.reporteNumericId = data.id;

    this.reporte.folio = data.folio ?? String(data.id);
    this.reporte.nombreCaso = data.nombre_caso ?? '';
    this.reporte.estado = data.estado ?? 'PENDIENTE';

    this.reporte.tipoAnimal = this.normalizarTipoAnimal(data.tipo_animal);
    this.reporte.tamanoAnimal = this.normalizarTamano(data.tamano_animal);

    this.reporte.notasAnimal = data.notas_animal ?? '';
    this.reporte.caracteristicas = data.caracteristicas ?? '';
    this.reporte.edadEstimada = data.edad_estimada ?? '';
    this.reporte.pesoEstimado = data.peso_estimado ?? '';

    this.reporte.lat = this.obtenerLatitud(data);
    this.reporte.lng = this.obtenerLongitud(data);
    this.reporte.ubicacionTexto = (data as any).direccion?.trim() || this.obtenerTextoUbicacion();
    this.reporte.nombreContacto = (data as any).nombre_contacto ?? '';
    this.reporte.telefonoContacto = (data as any).telefono_contacto ?? '';

    this.reporte.condicionesVisibles = this.obtenerCondicionesDesdeDatos(data);

    this.reporteOriginal = this.clonarReporte(this.reporte);

    this.cargando = false;

    this.cdr.detectChanges();

    setTimeout(() => {
      this.initInteractiveMap();

      setTimeout(() => {
        this.mapInteractive?.invalidateSize();
      }, 300);
    }, 500);
  }

  private clonarReporte(reporte: EditReportViewModel): EditReportViewModel {
    return JSON.parse(JSON.stringify(reporte));
  }

  private obtenerLatitud(data: any): number {
    return Number(data.lat_out ?? data.latitud ?? data.lat ?? 19.0042);
  }

  private obtenerLongitud(data: any): number {
    return Number(data.lng_out ?? data.longitud ?? data.lng ?? -98.2012);
  }

  private normalizarTipoAnimal(valor?: string | null): TipoAnimal {
    const texto = String(valor ?? '').toLowerCase();

    if (texto.includes('gato')) return 'gato';
    if (texto.includes('perro')) return 'perro';

    return '';
  }

  private normalizarTamano(valor?: string | null): TamanoAnimal {
    const texto = String(valor ?? '').toLowerCase();

    if (texto.includes('cachorro')) return 'cachorro';
    if (texto.includes('peque')) return 'pequeño';
    if (texto.includes('mediano')) return 'mediano';
    if (texto.includes('grande')) return 'grande';
    if (texto.includes('adulto')) return 'adulto';

    return '';
  }

  private obtenerCondicionesDesdeDatos(data: IncidenciaResponse): CondicionAnimal[] {
    const texto = `${data.condicion_animal ?? ''} ${data.caracteristicas ?? ''} ${data.notas_animal ?? ''}`.toLowerCase();

    const condiciones: CondicionAnimal[] = [];

    if (
      texto.includes('herido') ||
      texto.includes('herida') ||
      texto.includes('lastimado') ||
      texto.includes('sangre')
    ) {
      condiciones.push('herido');
    }

    if (
      texto.includes('callejero') ||
      texto.includes('callejera') ||
      texto.includes('calle') ||
      texto.includes('sin dueño')
    ) {
      condiciones.push('callejero');
    }

    if (
      texto.includes('extraviado') ||
      texto.includes('extraviada') ||
      texto.includes('perdido') ||
      texto.includes('perdida')
    ) {
      condiciones.push('extraviado');
    }

    if (condiciones.length === 0 && data.condicion_animal) {
      const condicion = data.condicion_animal.toLowerCase();

      if (condicion.includes('herido')) {
        condiciones.push('herido');
      } else if (condicion.includes('extraviado')) {
        condiciones.push('extraviado');
      } else {
        condiciones.push('callejero');
      }
    }

    return condiciones;
  }

  private obtenerTextoUbicacion(): string {
    if (this.reporte.lat != null && this.reporte.lng != null) {
      return `${this.reporte.lat.toFixed(6)}, ${this.reporte.lng.toFixed(6)}`;
    }

    return 'Ubicación registrada en el reporte original';
  }

initInteractiveMap(): void {
  const mapElement = document.getElementById('mapa-update');

  if (!mapElement || this.mapInteractive || this.reporte.lat == null || this.reporte.lng == null) {
    return;
  }

  this.mapInteractive = L.map('mapa-update', {
    center: [this.reporte.lat, this.reporte.lng],
    zoom: 16,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(this.mapInteractive);

  this.markerInteractive = L.marker(
    [this.reporte.lat, this.reporte.lng],
    { draggable: true }
  ).addTo(this.mapInteractive);

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

  setTimeout(() => {
    this.mapInteractive.invalidateSize();
    this.mapInteractive.setView([this.reporte.lat, this.reporte.lng], 16);
  }, 300);
}

  destroyInteractiveMap(): void {
    if (this.mapInteractive) {
      this.mapInteractive.remove();
      this.mapInteractive = null;
      this.markerInteractive = null;
    }
  }

  actualizarCoordenadas(lat: number, lng: number): void {
    this.reporte.lat = lat;
    this.reporte.lng = lng;
    this.reporte.ubicacionTexto = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  buscarDireccion(direccion: string): void {
    if (!direccion || direccion.trim().length < 3) return;

    this.cargandoDireccion = true;

    const query = encodeURIComponent(`${direccion}, Puebla`);

    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
      .then((response) => response.json())
      .then((data) => {
        this.cargandoDireccion = false;

        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);

          this.actualizarCoordenadas(lat, lng);
          this.reporte.ubicacionTexto =
            data[0].display_name?.split(',')[0] ?? `${lat}, ${lng}`;

          if (this.markerInteractive && this.mapInteractive) {
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
    this.reportService.obtenerDireccionCompleta(lat, lng).then(dir => {
      this.reporte.ubicacionTexto = dir;
      this.cdr.detectChanges();
    });
}

  seleccionarTipo(tipo: TipoAnimal): void {
    this.reporte.tipoAnimal = tipo;
    this.reporte.tamanoAnimal = '';
  }

  seleccionarTamano(tamano: TamanoAnimal): void {
    this.reporte.tamanoAnimal = tamano;
  }

  toggleCondicion(condicion: CondicionAnimal): void {
    const existe = this.reporte.condicionesVisibles.includes(condicion);

    if (existe) {
      this.reporte.condicionesVisibles =
        this.reporte.condicionesVisibles.filter((item) => item !== condicion);
      return;
    }

    if (condicion === 'callejero' && this.tieneCondicion('extraviado')) {
      return;
    }

    if (condicion === 'extraviado' && this.tieneCondicion('callejero')) {
      return;
    }

    this.reporte.condicionesVisibles = [
      ...this.reporte.condicionesVisibles,
      condicion,
    ];
  }

  tieneCondicion(condicion: CondicionAnimal): boolean {
    return this.reporte.condicionesVisibles.includes(condicion);
  }
  condicionBloqueada(condicion: CondicionAnimal): boolean {
  if (this.tieneCondicion(condicion)) {
    return false;
  }

  if (condicion === 'callejero') {
    return this.tieneCondicion('extraviado');
  }

  if (condicion === 'extraviado') {
    return this.tieneCondicion('callejero');
  }

  return false;
}

nombreCasoValido(): boolean {
  const nombre = this.reporte.nombreCaso.trim();

  if (nombre.length < 8 || nombre.length > 60) {
    return false;
  }

  const tieneLetras = /[A-Za-zÁÉÍÓÚáéíóúÑñÜü]/.test(nombre);
  const soloCaracteresValidos = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s.,-]+$/.test(nombre);
  const tienePalabrasSuficientes = nombre.split(/\s+/).length >= 2;
  const noEsLetraRepetida = !/^([A-Za-zÁÉÍÓÚáéíóúÑñÜü])\1+$/i.test(nombre);

  return tieneLetras && soloCaracteresValidos && tienePalabrasSuficientes && noEsLetraRepetida;
}

descripcionValida(): boolean {
  const descripcion = this.reporte.notasAnimal.trim();

  if (descripcion.length === 0) {
    return true;
  }

  if (descripcion.length < 10 || descripcion.length > 250) {
    return false;
  }

  const tieneLetras = /[A-Za-zÁÉÍÓÚáéíóúÑñÜü]/.test(descripcion);
  const noEsLetraRepetida = !/^([A-Za-zÁÉÍÓÚáéíóúÑñÜü])\1+$/i.test(descripcion);

  return tieneLetras && noEsLetraRepetida;
}

  nombreContactoValido(): boolean {
    const nombre = this.reporte.nombreContacto.trim();

    if (nombre.length < 5 || nombre.length > 80) {
      return false;
    }

    const regexNombre = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
    const tienePalabrasSuficientes = nombre.split(/\s+/).length >= 2;
    const noEsLetraRepetida = !/^([A-Za-zÁÉÍÓÚáéíóúÑñÜü])\1+$/i.test(nombre);

    return regexNombre.test(nombre) && tienePalabrasSuficientes && noEsLetraRepetida;
  }

  telefonoContactoValido(): boolean {
    const telefono = this.reporte.telefonoContacto.trim();
    return /^\d{10}$/.test(telefono);
  }

  formularioValido(): boolean {
    return (
      this.nombreCasoValido() &&
      !!this.reporte.tipoAnimal &&
      !!this.reporte.tamanoAnimal &&
      this.reporte.condicionesVisibles.length > 0 &&
      this.descripcionValida() &&
      this.nombreContactoValido() &&
      this.telefonoContactoValido() &&
      this.reporte.lat != null &&
      this.reporte.lng != null
    );
  }

  get condicionesTexto(): string {
    if (this.reporte.condicionesVisibles.length === 0) {
      return 'Sin condición seleccionada';
    }

    return this.reporte.condicionesVisibles.join(', ');
  }

  get cambiosAplicados(): CambioAplicado[] {
    if (!this.reporteOriginal) return [];

    const cambios: CambioAplicado[] = [];

    this.agregarCambio(
      cambios,
      'Nombre del caso',
      this.reporteOriginal.nombreCaso,
      this.reporte.nombreCaso
    );

    this.agregarCambio(
      cambios,
      'Tipo de animal',
      this.reporteOriginal.tipoAnimal,
      this.reporte.tipoAnimal
    );

    this.agregarCambio(
      cambios,
      'Tamaño aproximado',
      this.reporteOriginal.tamanoAnimal,
      this.reporte.tamanoAnimal
    );

    this.agregarCambio(
      cambios,
      'Condición visible',
      this.reporteOriginal.condicionesVisibles.join(', '),
      this.reporte.condicionesVisibles.join(', ')
    );

    this.agregarCambio(
      cambios,
      'Notas del reporte',
      this.reporteOriginal.notasAnimal,
      this.reporte.notasAnimal
    );

    this.agregarCambio(
      cambios,
      'Características',
      this.reporteOriginal.caracteristicas,
      this.reporte.caracteristicas
    );

    this.agregarCambio(
      cambios,
      'Ubicación',
      this.reporteOriginal.ubicacionTexto,
      this.reporte.ubicacionTexto
    );
    this.agregarCambio(
      cambios,
      'Nombre de contacto',
      this.reporteOriginal.nombreContacto,
      this.reporte.nombreContacto
    );

    this.agregarCambio(
      cambios,
      'Teléfono de contacto',
      this.reporteOriginal.telefonoContacto,
      this.reporte.telefonoContacto
    );

    if (this.imagenNueva) {
      cambios.push({
        campo: 'Imagen del reporte',
        antes: 'Imagen anterior',
        ahora: this.imagenNueva.name,
      });
    }

    return cambios;
  }

  get hayCambios(): boolean {
    return this.cambiosAplicados.length > 0;
  }

  private agregarCambio(
    cambios: CambioAplicado[],
    campo: string,
    antes: string | null | undefined,
    ahora: string | null | undefined
  ): void {
    const valorAntes = String(antes ?? '').trim();
    const valorAhora = String(ahora ?? '').trim();

    if (valorAntes !== valorAhora) {
      cambios.push({
        campo,
        antes: valorAntes || 'Sin dato',
        ahora: valorAhora || 'Sin dato',
      });
    }
  }

  calcularUrgencia(): number {
    let score = 0;

    if (this.tieneCondicion('herido')) score += 60;
    if (this.tieneCondicion('callejero')) score += 20;
    if (this.tieneCondicion('extraviado')) score += 25;

    return Math.min(score, 100);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.imagenNueva = file;

    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.imagenPreview = String(e.target?.result ?? '');
      this.cdr.detectChanges();
    };

    reader.readAsDataURL(file);
  }

  eliminarImagenNueva(): void {
    this.imagenNueva = null;
    this.imagenPreview = null;
  }

  guardarCambios(): void {
    this.error = null;
    this.mensajeExito = null;

    if (!this.hayCambios) {
      this.error = 'No hay cambios para guardar.';
      return;
    }

    if (!this.nombreCasoValido()) {
      this.error = 'Escribe un nombre de caso válido.';
      return;
    }

    if (!this.reporte.tipoAnimal) {
      this.error = 'Selecciona el tipo de animal.';
      return;
    }

    if (!this.reporte.tamanoAnimal) {
      this.error = 'Selecciona el tamaño aproximado.';
      return;
    }

    if (this.reporte.condicionesVisibles.length === 0) {
      this.error = 'Selecciona al menos una condición visible.';
      return;
    }
    if (!this.descripcionValida()) {
      this.error = 'La descripción debe tener al menos 10 caracteres útiles.';
      return;
    }

    if (!this.nombreContactoValido()) {
      this.error = 'Escribe un nombre de contacto válido.';
      return;
    }

    if (!this.telefonoContactoValido()) {
      this.error = 'El teléfono debe tener exactamente 10 dígitos.';
      return;
    }

    if (this.reporte.lat == null || this.reporte.lng == null) {
      this.error = 'Selecciona una ubicación válida.';
      return;
    }

    this.guardando = true;

    const payload: any = {
      nombre_caso: this.reporte.nombreCaso.trim(),
      tipo_animal: this.reporte.tipoAnimal,
      tamano_animal: this.reporte.tamanoAnimal,
      condicion_animal: this.condicionesTexto,
      notas_animal: this.reporte.notasAnimal.trim(),
      caracteristicas: this.reporte.caracteristicas.trim(),
      edad_estimada: String(this.reporte.edadEstimada ?? ''),
      peso_estimado: String(this.reporte.pesoEstimado ?? ''),

      latitud: this.reporte.lat,
      longitud: this.reporte.lng,
      lat_out: this.reporte.lat,
      lng_out: this.reporte.lng,
      direccion: this.reporte.ubicacionTexto,

      nombre_contacto: this.reporte.nombreContacto.trim(),
      telefono_contacto: this.reporte.telefonoContacto.trim(),

      urgency_score: this.calcularUrgencia(),
    };
    console.log('PAYLOAD UPDATE REPORTE:', payload);

    if (this.imagenNueva) {
      payload.imagen = this.imagenNueva;
    }

    this.reportService.actualizarReporte(this.reporteNumericId, payload).subscribe({
      next: (res) => {
        console.log('REPORTE ACTUALIZADO:', res);

        this.guardando = false;
        this.mensajeExito = 'Reporte actualizado correctamente.';
        this.reporteOriginal = this.clonarReporte(this.reporte);
        this.imagenNueva = null;
        this.imagenPreview = null;

        setTimeout(() => {
          this.router.navigate(['/dashboard/reporter']);
        }, 1200);
      },
      error: (err) => {
        console.error('ERROR ACTUALIZANDO REPORTE:', err);
        this.guardando = false;
        this.error = 'No se pudo actualizar el reporte. Revisa los datos e intenta de nuevo.';
      },
    });
  }

  irADetalle(): void {
    this.router.navigate(['/view-report', this.reporte.folio]);
  }

  irASeguimiento(): void {
    this.router.navigate(['/reports', this.reporte.folio, 'follow-up']);
  }

  volverDashboard(): void {
    this.router.navigate(['/dashboard/reporter']);
  }
}