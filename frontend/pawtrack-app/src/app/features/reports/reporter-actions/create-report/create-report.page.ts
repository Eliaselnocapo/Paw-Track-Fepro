import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, CandidatoDuplicado } from '../../../../core/services/report.service';
import { LocalReportCacheService } from '../../../../core/services/local-report-cache.service';
import { IonContent, IonModal } from '@ionic/angular/standalone';

declare let L: any;

@Component({
  selector: 'app-create-report',
  templateUrl: './create-report.page.html',
  styleUrls: ['./create-report.page.scss'],
  imports: [
    CommonModule,
    DecimalPipe,
    FormsModule,
    RouterLink,
    IonContent,
    IonModal,
    NavbarWebComponent,
    FooterWebComponent
  ],
  standalone: true,
})
export class CreateReportPage implements OnInit, AfterViewInit {

  pasoActual: number = 1;

  tipoAnimal: string = '';
  colorAnimal: string = '';
  razaAnimal: string = '';
  agresividadAnimal: string = '';
  tamanoAproximado: string = '';
  condicionesVisibles: string[] = [];
  condicionesTexto: string = 'Ninguna';
  notasAdicionales: string = '';
  nombreCaso: string = '';

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
  // true cuando se confirmó que era el mismo caso y el back borró el
  // reporte nuevo (ver ReportService.crearReporte) — se muestra la misma
  // pantalla de confirmación, sin folio propio, en vez de la ventana de
  // "es el mismo caso ¿si o no?".
  duplicadoDescartado = false;
  folioExistente: string | null = null;

  // === Chequeo de posible duplicado (paso 4, antes de enviar) ===
  verificandoDuplicado = false;
  candidatoDuplicado: CandidatoDuplicado | null = null;
  duplicadoConfirmado: boolean | null = null; // null = sin responder todavía

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

  constructor(private cdr: ChangeDetectorRef, private reportService: ReportService, private localReportCache: LocalReportCacheService,) {}

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

    // /search devuelve un ARRAY con lat/lon, pero NO trae el objeto 'address'
    // desglosado (ese solo viene de /reverse). Por eso tomamos las coordenadas
    // y dejamos que obtenerDireccionCompleta() arme la direccion formateada.
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
      .then(response => response.json())
      .then(async (data) => {
        if (!Array.isArray(data) || data.length === 0) {
          this.cargandoDireccion = false;
          this.cdr.detectChanges();
          return;
        }

        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        this.latActual = lat;
        this.lngActual = lng;

      // Movemos el mapa y el pin al punto encontrado
        if (this.mapInteractive && this.markerInteractive) {
          this.mapInteractive.setView([lat, lng], 17);
          this.markerInteractive.setLatLng([lat, lng]);
        }

        // La direccion formateada, siempre por la misma via
        this.direccionActual = await this.reportService.obtenerDireccionCompleta(lat, lng);
        this.ciudadActual = data[0].display_name?.split(',').slice(-3).join(',').trim() || 'Puebla, México';

        this.cargandoDireccion = false;
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.cargandoDireccion = false;
        this.cdr.detectChanges();
      });
  }

  obtenerDireccionDesdeCoordenadas(lat: number, lng: number) {
    this.cargandoDireccion = true;

    // Usamos el metodo del service (formato completo: calle, colonia, CP,
    // ciudad, estado, pais) en vez de armar la direccion a mano aqui.
    this.reportService.obtenerDireccionCompleta(lat, lng)
      .then(dir => {
        this.direccionActual = dir;
        this.cargandoDireccion = false;
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
      if (this.pasoActual === 4) { this.initPreviewMap(); this.verificarDuplicado(); }
      if (this.pasoActual === 5) this.guardarBaseDatosLocal(); // Corregido el nombre aquí
    }
  }

  /**
   * Dispara la consulta de verificar-duplicado al back con lo capturado
   * hasta ahora (imagen + tipo/tamaño/color/raza + ubicación). Devuelve
   * `null` si no hay ni imagen ni especie (nada que comparar) — en ese caso
   * el llamador debe tratarlo como "sin candidato" directamente. Factoreado
   * porque tanto la entrada al paso 4 como el re-chequeo antes de enviar
   * (ver intentarEnviar()) necesitan la misma consulta, con manejo distinto
   * de la respuesta.
   */
  private _consultarDuplicado() {
    const imagen = this.archivosSeleccionados[0]?.archivoFisico;
    if (!imagen || !this.tipoAnimal) return null;

    return this.reportService.verificarDuplicado({
      tipo_animal: this.tipoAnimal,
      tamano_animal: this.tamanoAproximado || undefined,
      color_animal: this.colorAnimal || undefined,
      raza_animal: this.razaAnimal.trim() || undefined,
      latitud: this.latActual,
      longitud: this.lngActual,
      imagen,
    });
  }

  /**
   * Chequeo síncrono de posible duplicado — corre automáticamente al llegar
   * al paso 4 (revisión final). Si el back encuentra un candidato parecido,
   * se le pregunta al reportante aquí mismo, ANTES de crear el reporte —
   * ver decision-tecnica-filtro-raza.md.
   */
  verificarDuplicado(): void {
    const request$ = this._consultarDuplicado();
    if (!request$) return;

    this.verificandoDuplicado = true;
    this.candidatoDuplicado = null;
    this.duplicadoConfirmado = null;

    request$.subscribe({
      next: (res) => {
        this.verificandoDuplicado = false;
        this.candidatoDuplicado = res.candidato;
      },
      error: () => {
        // Falla silenciosa a propósito: si el chequeo no responde, no
        // queremos bloquear al reportante de enviar su reporte por esto.
        this.verificandoDuplicado = false;
        this.candidatoDuplicado = null;
      },
    });
  }

  /**
   * Se llama al hacer clic en "Enviar reporte" (en vez de siguientePaso()
   * directo). Antes de avanzar, vuelve a chequear duplicados: si algo
   * cambió desde que se entró al paso 4 (otro reportante creó un caso
   * parecido mientras este seguía en revisión), se le pregunta aquí en vez
   * de dejarlo pasar. Reduce la ventana de carrera casi al tamaño que tenía
   * el chequeo async viejo (solo latencia de Celery, no lo que el
   * reportante se tarde en revisar el paso 4) — ver
   * Resumen_Motor_Deduplicacion_Parte2.md.
   */
  intentarEnviar(): void {
    if (this.verificandoDuplicado) return;

    const request$ = this._consultarDuplicado();
    if (!request$) { this.siguientePaso(); return; }

    this.verificandoDuplicado = true;

    request$.subscribe({
      next: (res) => {
        this.verificandoDuplicado = false;
        const candidato = res.candidato;
        const esElMismoQueYaSeRespondio =
          candidato && this.candidatoDuplicado && candidato.folio === this.candidatoDuplicado.folio;

        if (candidato && !esElMismoQueYaSeRespondio) {
          // Candidato nuevo (o distinto) desde el último chequeo: hay que
          // preguntar de nuevo antes de dejar avanzar.
          this.candidatoDuplicado = candidato;
          this.duplicadoConfirmado = null;
          return;
        }

        if (!candidato) {
          this.candidatoDuplicado = null;
          this.duplicadoConfirmado = null;
        }
        // Si es el mismo candidato que ya se respondió, se respeta esa respuesta.

        this.siguientePaso();
      },
      error: () => {
        // Falla en silencio: no bloquea el envío por un problema del chequeo.
        this.verificandoDuplicado = false;
        this.siguientePaso();
      },
    });
  }

  marcarComoMismoCaso(): void {
    this.duplicadoConfirmado = true;
  }

  marcarComoDistinto(): void {
    this.duplicadoConfirmado = false;
  }

  /** true mientras haya un candidato mostrado y el reportante no haya respondido — bloquea el envío. */
  get faltaResponderDuplicado(): boolean {
    return !!this.candidatoDuplicado && this.duplicadoConfirmado === null;
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
  seleccionarColor(color: string) { this.colorAnimal = color; }
  seleccionarTipo(tipo: string) { this.tipoAnimal = tipo; }
  seleccionarTamano(tamano: string) { this.tamanoAproximado = tamano; }
  seleccionarAgresividad(valor: string) { this.agresividadAnimal = valor; }
  
  toggleCondicion(condicion: string) {
    const index = this.condicionesVisibles.indexOf(condicion);

    if (index > -1) {
      this.condicionesVisibles.splice(index, 1);
    } else {
      if (
        condicion === 'callejero' &&
        this.condicionesVisibles.includes('extraviado')
      ) {
        return;
      }

      if (
        condicion === 'extraviado' &&
        this.condicionesVisibles.includes('callejero')
      ) {
        return;
      }

      this.condicionesVisibles.push(condicion);
    }

    this.condicionesTexto = this.condicionesVisibles.length > 0
      ? this.condicionesVisibles.join(', ')
      : 'Ninguna';
  }
  tieneCondicion(condicion: string): boolean {
    return this.condicionesVisibles.includes(condicion);
  }
  condicionBloqueada(condicion: string): boolean {
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
    const nombre = this.nombreCaso.trim();

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
    const descripcion = this.notasAdicionales.trim();

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
    const nombre = this.nombreUsuario.trim();

    if (nombre.length < 5 || nombre.length > 80) {
      return false;
    }

    const regexNombre = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
    const tienePalabrasSuficientes = nombre.split(/\s+/).length >= 2;
    const noEsLetraRepetida = !/^([A-Za-zÁÉÍÓÚáéíóúÑñÜü])\1+$/i.test(nombre);

    return regexNombre.test(nombre) && tienePalabrasSuficientes && noEsLetraRepetida;
  }

  telefonoContactoValido(): boolean {
    const telefono = this.telefonoUsuario.trim();
    const regexTelefono = /^\d{10}$/;

    return regexTelefono.test(telefono);
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
      nombre_caso:       this.nombreCaso,
      tipo_animal:       this.tipoAnimal,
      tamano_animal:     this.tamanoAproximado,
      condicion_animal:  this.condicionesTexto,
      notas_animal:      this.notasAdicionales,
      latitud:           this.latActual,
      longitud:          this.lngActual,
      direccion:         this.direccionActual,   // ← AGREGA ESTA LÍNEA
      color_animal:      this.colorAnimal     || undefined,
      raza_animal:       this.razaAnimal.trim()  || undefined,
      agresividad_animal: this.agresividadAnimal  || undefined,
      imagen:            this.archivosSeleccionados[0]?.archivoFisico,
      nombre_contacto:   this.nombreUsuario   || undefined,
      telefono_contacto: this.telefonoUsuario || undefined,
      duplicado_candidato_folio: this.candidatoDuplicado?.folio ?? undefined,
      duplicado_confirmado:      this.duplicadoConfirmado ?? undefined,
      duplicado_score:           this.candidatoDuplicado?.score,
    }).subscribe({
    next: (res) => {
      console.log('REPORTE CREADO:', res);
      this.enviando = false;

      if ('duplicado_descartado' in res) {
        // Confirmado como el mismo caso: el back ya borró el reporte nuevo,
        // no hay folio propio que generar.
        this.duplicadoDescartado = true;
        this.folioExistente = res.folio_existente;
        this.destroyPreviewMap();
        return;
      }

      this.folioGenerado = res.folio ?? `#${res.id}`;

      const haySesion = !!localStorage.getItem('pawtrack_access');

      if (!haySesion && res.folio) {
        this.localReportCache.guardarFolio(res.folio);

        console.log(
          'FOLIOS DE INVITADO DESPUÉS DE CREAR:',
          this.localReportCache.obtenerFolios()
        );
      }

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
  get enlaceSeguimiento(): string {
  if (!this.folioGenerado) {
    return '';
  }

  return `/seguimiento/${this.folioGenerado}`;
}

copiarEnlaceSeguimiento(): void {
  if (!this.folioGenerado) {
    return;
  }

  const enlaceCompleto = `${window.location.origin}${this.enlaceSeguimiento}`;

  navigator.clipboard.writeText(enlaceCompleto)
    .then(() => {
      console.log('Enlace copiado:', enlaceCompleto);
    })
    .catch((err) => {
      console.error('No se pudo copiar el enlace:', err);
    });
}
}