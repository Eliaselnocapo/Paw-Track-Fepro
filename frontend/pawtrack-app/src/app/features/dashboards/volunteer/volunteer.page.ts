import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { AuthService } from '../../../core/services/auth.service';

import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse } from '../../../core/services/report.service';
import { SentenceCasePipe } from '../../../shared/pipes/sentence-case-pipe';
import { environment } from 'src/environments/environment';

import { RevealDirective } from 'src/app/shared/directives/reveal.directive';

interface CasoVoluntario {
  id: number;
  folio: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  tiempo: string;
  tamano: string;
  condicion: string;
  contactoNombre: string;
  contactoTelefono: string;
  score: number;
  prioridad: 'Urgente' | 'Alta' | 'Moderada';
  especie: 'Perro' | 'Gato' | 'Otro';
  fotoUrl: string;
  estado: string;
  validado: boolean;
  trustScore: number;
  raw: IncidenciaResponse;
}

interface OpcionRadio {
  valor: number | null;
  etiqueta: string;
  ayuda: string;
}

@Component({
  selector: 'app-volunteer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    TitleCasePipe,
    SentenceCasePipe,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
  ],
  templateUrl: './volunteer.page.html',
  styleUrls: ['./volunteer.page.scss']
})
export class VolunteerPage implements OnInit {

  private readonly http = inject(HttpClient);

  searchTerm: string = '';
  filtroActivo: string = 'Todos';
  vistaCasos: 'disponibles' | 'urgentes' | 'aceptados' = 'disponibles';

  casosPorPagina = 5;
  paginaActualCasos = 1;

  casos: CasoVoluntario[] = [];
  cargando = true;
  errorCarga: string | null = null;

  // ── Ubicación y radio ──────────────────────────────────────────────────

  ubicacion: { lat: number; lng: number } | null = null;

  /** Texto del header. Arranca neutro y no con una ciudad inventada: decirle
   *  "Zona Metropolitana, CDMX" a alguien en Puebla es peor que no decir nada. */
  zonaTexto = 'Detectando tu zona...';

  /** null = sin límite de distancia (todos los casos del país). */
  radioKm: number | null = 10;

  readonly opcionesRadio: OpcionRadio[] = [
    { valor: 5,    etiqueta: 'Hasta 5 km',   ayuda: 'Solo lo más cercano' },
    { valor: 10,   etiqueta: 'Hasta 10 km',  ayuda: 'Tu zona habitual' },
    { valor: 25,   etiqueta: 'Hasta 25 km',  ayuda: 'Incluye municipios vecinos' },
    { valor: null, etiqueta: 'Todo el país', ayuda: 'Sin filtro de distancia' },
  ];

  /** Los valores deben coincidir con CasoVoluntario.prioridad, que es lo que
   *  compara casosFiltrados. */
  readonly opcionesPrioridad = [
    { valor: 'Todos',    etiqueta: 'Todas las prioridades' },
    { valor: 'Urgente',  etiqueta: 'Urgentes' },
    { valor: 'Alta',     etiqueta: 'Prioridad alta' },
    { valor: 'Moderada', etiqueta: 'Prioridad moderada' },
  ];

  dropdownRadio = false;
  dropdownPrioridad = false;

  constructor(
    private reportService: ReportService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.detectarUbicacion();
  }

  ionViewWillEnter(): void {
    // Solo recarga si ya se resolvió la ubicación: en el primer ngOnInit
    // detectarUbicacion() se encarga de llamar a cargarCasos().
    if (this.ubicacion !== null || this.radioKm === null) {
      this.cargarCasos();
    }
  }

  // ── Ubicación ──────────────────────────────────────────────────────────

  /** Pide el GPS del navegador. Si el usuario lo niega no se bloquea nada:
   *  se muestran todos los casos y el header lo explica. */
  private detectarUbicacion(): void {
    if (!navigator.geolocation) {
      this.sinUbicacion();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.ubicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.resolverNombreZona();
        this.cargarCasos();
      },
      () => this.sinUbicacion(),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  private sinUbicacion(): void {
    this.ubicacion = null;
    this.radioKm = null;
    this.zonaTexto = 'todo el país';
    this.cargarCasos();
  }

  /** Reverse geocoding con Nominatim, solo para el texto del header. Si falla,
   *  el filtro por distancia sigue funcionando igual. */
  private resolverNombreZona(): void {
    if (!this.ubicacion) return;

    const { lat, lng } = this.ubicacion;
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=es`;

    this.http.get<any>(url).subscribe({
      next: (r) => {
        const a = r?.address ?? {};
        const ciudad = a.city || a.town || a.village || a.municipality || a.county;
        const estado = a.state;
        this.zonaTexto = [ciudad, estado].filter(Boolean).join(', ') || 'tu zona';
      },
      error: () => {
        this.zonaTexto = 'tu zona';
      },
    });
  }

  // ── Carga de casos ─────────────────────────────────────────────────────

  cargarCasos(): void {
    this.cargando = true;
    this.errorCarga = null;

    // Sin ubicación o con radio null se piden todos: el backend ignora el
    // filtro geográfico si no le llegan lat/lng.
    const filtro = (this.ubicacion && this.radioKm !== null)
      ? { lat: this.ubicacion.lat, lng: this.ubicacion.lng, radio_km: this.radioKm }
      : undefined;

    this.reportService.listarReportes(filtro).subscribe({
      next: (resp: any) => {
        const incidencias: IncidenciaResponse[] = Array.isArray(resp)
          ? resp
          : Array.isArray(resp.results)
            ? resp.results
            : Array.isArray(resp.data)
              ? resp.data
              : Array.isArray(resp.incidencias)
                ? resp.incidencias
                : [];

        this.casos = incidencias
          .filter((incidencia) => this.esCasoVisibleParaVoluntario(incidencia))
          .map((incidencia) => this.mapearCaso(incidencia));

        this.paginaActualCasos = 1;
        this.cargando = false;
      },
      error: (err) => {
        console.error('ERROR CARGANDO CASOS:', err);
        this.errorCarga = 'No se pudieron cargar los casos disponibles.';
        this.casos = [];
        this.cargando = false;
      }
    });
  }

  private esCasoVisibleParaVoluntario(incidencia: IncidenciaResponse): boolean {
    const estado = incidencia.estado || 'PENDIENTE';
    // PENDIENTE sigue visible a propósito: el estado indica confianza en el
    // reporte, no bloquea el rescate.
    return estado === 'PENDIENTE' || estado === 'VALIDADO';
  }

  private mapearCaso(incidencia: IncidenciaResponse): CasoVoluntario {
    return {
      id: incidencia.id,
      folio: incidencia.folio || `RPT-${incidencia.id}`,
      titulo: this.obtenerTituloCaso(incidencia),
      descripcion: this.obtenerDescripcionCaso(incidencia),
      ubicacion: this.obtenerUbicacionCaso(incidencia),
      tiempo: this.obtenerTiempoReporte(incidencia.created_at),
      tamano: incidencia.tamano_animal || 'No especificado',
      condicion: incidencia.condicion_animal || 'No especificada',
      contactoNombre: incidencia.nombre_contacto || 'Contacto no registrado',
      contactoTelefono: incidencia.telefono_contacto || 'Teléfono no registrado',
      score: Math.round(incidencia.urgency_score || 0),
      prioridad: this.obtenerPrioridad(incidencia.urgency_score || 0),
      especie: this.obtenerEspecie(incidencia.tipo_animal),
      fotoUrl: this.imagenUrl(incidencia.imagen),
      estado: incidencia.estado || 'PENDIENTE',
      validado: incidencia.estado === 'VALIDADO',
      trustScore: incidencia.trust_score ?? 50,
      raw: incidencia,
    };
  }

  // ── Dropdowns ──────────────────────────────────────────────────────────

  get etiquetaPrioridad(): string {
    const p = this.opcionesPrioridad.find(o => o.valor === this.filtroActivo);
    return p?.etiqueta ?? 'Todas las prioridades';
  }

  seleccionarPrioridad(valor: string): void {
    this.filtroActivo = valor;
    this.dropdownPrioridad = false;
    this.paginaActualCasos = 1;
  }

  /** El alcance no es una prioridad: cambia qué casos se piden al backend,
   *  no cómo se filtran los que ya llegaron. Por eso va aparte. */
  alternarAlcance(): void {
    this.dropdownPrioridad = false;

    if (this.radioKm === null) {
      if (!this.ubicacion) return;
      this.radioKm = 10;
      this.resolverNombreZona();
    } else {
      this.radioKm = null;
      this.zonaTexto = 'todo el país';
    }

    this.cargarCasos();
  }

  @HostListener('document:click', ['$event'])
  onClickFuera(event: MouseEvent): void {
    const t = event.target as HTMLElement;
    if (!t.closest('[data-drop-radio]'))     this.dropdownRadio = false;
    if (!t.closest('[data-drop-prioridad]')) this.dropdownPrioridad = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dropdownRadio = false;
    this.dropdownPrioridad = false;
  }

  // ── Helpers de presentación ────────────────────────────────────────────

  private obtenerTituloCaso(incidencia: IncidenciaResponse): string {
    if (incidencia.nombre_caso && incidencia.nombre_caso.trim()) {
      return incidencia.nombre_caso;
    }

    const animal = incidencia.tipo_animal || 'Animal';
    const condicion = this.primerCondicion(incidencia.condicion_animal);

    return `${animal} ${condicion}`.trim();
  }

  private obtenerDescripcionCaso(incidencia: IncidenciaResponse): string {
    const notas = incidencia.notas_animal?.trim();

    if (!notas) {
      return 'Sin notas adicionales.';
    }

    const limite = 110;

    return notas.length > limite
      ? `${notas.slice(0, limite).trim()}...`
      : notas;
  }

  private obtenerUbicacionCaso(incidencia: IncidenciaResponse): string {
    if (incidencia.direccion?.trim()) {
      return incidencia.direccion.trim();
    }

    if (incidencia.lat_out != null && incidencia.lng_out != null) {
      return `${incidencia.lat_out.toFixed(5)}, ${incidencia.lng_out.toFixed(5)}`;
    }

    return 'Ubicación no disponible';
  }

  private obtenerTiempoReporte(fecha: string | null): string {
    if (!fecha) return 'Fecha no disponible';

    const fechaReporte = new Date(fecha);
    const ahora = new Date();

    const diferenciaMs = ahora.getTime() - fechaReporte.getTime();
    const minutos = Math.floor(diferenciaMs / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (minutos < 1) return 'Hace unos segundos';
    if (minutos < 60) return `Hace ${minutos} min`;
    if (horas < 24) return `Hace ${horas} h`;

    return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
  }

  private obtenerPrioridad(score: number): 'Urgente' | 'Alta' | 'Moderada' {
    if (score >= 80) return 'Urgente';
    if (score >= 40) return 'Alta';
    return 'Moderada';
  }

  private obtenerEspecie(tipo: string | null): 'Perro' | 'Gato' | 'Otro' {
    const normalizado = tipo?.toLowerCase();

    if (normalizado === 'perro') return 'Perro';
    if (normalizado === 'gato') return 'Gato';

    return 'Otro';
  }

  private primerCondicion(val: string | null): string {
    if (!val) return 'sin condición especificada';

    return val.split(',')[0]?.trim() || 'sin condición especificada';
  }

  imagenUrl(imagen: string | null): string {
    if (!imagen) {
      return 'assets/images/report-placeholder.jpg';
    }

    if (imagen.startsWith('http')) {
      return imagen;
    }

    return `${environment.apiUrl}${imagen}`;
  }

  // ── Filtrado y paginación ──────────────────────────────────────────────

  get casosFiltrados(): CasoVoluntario[] {
    let filtrados = this.casos;

    if (this.filtroActivo !== 'Todos') {
      filtrados = filtrados.filter(c => c.prioridad === this.filtroActivo);
    }

    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase();

      filtrados = filtrados.filter(c =>
        c.titulo.toLowerCase().includes(term) ||
        c.ubicacion.toLowerCase().includes(term) ||
        c.descripcion.toLowerCase().includes(term) ||
        c.especie.toLowerCase().includes(term) ||
        c.tamano.toLowerCase().includes(term) ||
        c.condicion.toLowerCase().includes(term) ||
        c.contactoNombre.toLowerCase().includes(term) ||
        c.contactoTelefono.toLowerCase().includes(term) ||
        c.folio.toLowerCase().includes(term)
      );
    }

    return filtrados;
  }

  get casosPorVista(): CasoVoluntario[] {
    return this.casosFiltrados;
  }

  get totalPaginasCasos(): number {
    return Math.ceil(this.casosPorVista.length / this.casosPorPagina);
  }

  get casosPaginados(): CasoVoluntario[] {
    const inicio = (this.paginaActualCasos - 1) * this.casosPorPagina;
    const fin = inicio + this.casosPorPagina;

    return this.casosPorVista.slice(inicio, fin);
  }

  get inicioPaginaCasos(): number {
    if (this.casosPorVista.length === 0) return 0;

    return (this.paginaActualCasos - 1) * this.casosPorPagina + 1;
  }

  get finPaginaCasos(): number {
    const fin = this.paginaActualCasos * this.casosPorPagina;

    return Math.min(fin, this.casosPorVista.length);
  }

  get paginasCasos(): number[] {
    return Array.from(
      { length: this.totalPaginasCasos },
      (_, index) => index + 1
    );
  }

  cambiarPaginaCasos(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasCasos) return;

    this.paginaActualCasos = pagina;
  }

  get alertasCercanas(): CasoVoluntario[] {
    return this.casos
      .filter(caso => caso.prioridad === 'Urgente' || caso.prioridad === 'Alta')
      .slice(0, 2);
  }

  // ── Acciones ───────────────────────────────────────────────────────────

  setFiltro(filtro: string): void {
    this.filtroActivo = filtro;
  }

  aceptarMision(caso: CasoVoluntario): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], {
        queryParams: {
          returnUrl: this.router.url
        }
      });
      return;
    }
    this.router.navigate(['/accept-case', caso.folio]);
  }

  verDetalles(caso: CasoVoluntario): void {
    this.router.navigate(['/details-case', caso.folio]);
  }
}