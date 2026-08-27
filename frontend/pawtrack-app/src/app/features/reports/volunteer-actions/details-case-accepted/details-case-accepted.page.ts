import { Component, OnInit, AfterViewInit, OnDestroy  } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, RescateResponse } from '../../../../core/services/report.service';
import { environment } from 'src/environments/environment';

import { CartelPdf } from '../../../../core/services/cartel-pdf';
import { RevealDirective } from 'src/app/shared/directives/reveal.directive';

import * as L from 'leaflet';

@Component({
  selector: 'app-details-case-accepted',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
  ],
  templateUrl: './details-case-accepted.page.html',
  styleUrls: ['./details-case-accepted.page.scss'],
})
export class DetailsCaseAcceptedPage implements OnInit, AfterViewInit, OnDestroy {

  rescate: RescateResponse | null = null;
  private mapa: any = null;
  cargando = true;
  errorCarga: string | null = null;
  generandoCartel = false;
  errorCartel: string | null = null;

  // Pasos del stepper (solo lectura)
  pasos = ['En camino', 'En sitio', 'Rescatado'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
    private cartelPdf: CartelPdf
  ) {}

  ngOnInit(): void {
    this.cargarCaso();
  }

  ngAfterViewInit(): void {
  // esperamos a que el rescate cargue; lo inicializa cargarCaso al terminar
}

private initMapa(): void {
  if (this.mapa || this.latitud == null || this.longitud == null) return;

  // pequeño delay para que el div exista en el DOM
  setTimeout(() => {
    const el = document.getElementById('mapa-detalle');
    if (!el || this.latitud == null || this.longitud == null) return;

    this.mapa = L.map('mapa-detalle', {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    }).setView([this.latitud, this.longitud], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.mapa);

    const icono = L.divIcon({
      className: 'pin-detalle',
      html: '<div class="pin-detalle-inner"><span class="material-symbols-outlined">pets</span></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    L.marker([this.latitud, this.longitud], { icon: icono }).addTo(this.mapa);
  }, 100);
}
  // ─────────────────────────────────────────
  // Carga: por folio buscamos el rescate en mis-rescates
  // ─────────────────────────────────────────

  cargarCaso(): void {
    const folio = this.route.snapshot.paramMap.get('folio');

    if (!folio) {
      this.errorCarga = 'No se encontró el folio del caso.';
      this.cargando = false;
      return;
    }

    this.cargando = true;
    this.errorCarga = null;

    this.reportService.listarMisRescates().subscribe({
      next: (resp) => {
        const encontrado = resp.results.find(r => r.incidencia?.folio === folio);

        if (!encontrado) {
          this.errorCarga = 'Este caso no está entre tus rescates aceptados.';
          this.cargando = false;
          return;
        }

        this.rescate = encontrado;
        this.cargando = false;
        this.initMapa();
      },
      error: () => {
        this.errorCarga = 'No se pudo cargar la información del caso.';
        this.cargando = false;
      },
    });
  }

    ngOnDestroy(): void {
      if (this.mapa) {
        this.mapa.off();
        this.mapa.remove();
        this.mapa = null;
      }
    }
  // ─────────────────────────────────────────
  // Getters de presentación
  // ─────────────────────────────────────────

  get titulo(): string {
    const i = this.rescate?.incidencia;
    return i?.nombre_caso?.trim() || `${i?.tipo_animal ?? 'Animal'} en incidencia`;
  }

  get descripcion(): string {
    return this.rescate?.incidencia?.['notas_animal']?.trim() || 'Sin notas registradas por el reportante.';
  }

  get ubicacion(): string {
    const i = this.rescate?.incidencia;
    if (i?.lat_out != null && i?.lng_out != null) {
      return `${i.lat_out.toFixed(5)}, ${i.lng_out.toFixed(5)}`;
    }
    return 'Ubicación no disponible';
  }

  get latitud(): number | null {
    return this.rescate?.incidencia?.lat_out ?? null;
  }

  get longitud(): number | null {
    return this.rescate?.incidencia?.lng_out ?? null;
  }

  get especie(): string {
    return this.rescate?.incidencia?.tipo_animal || 'No especificado';
  }

  get tamano(): string {
    return this.rescate?.incidencia?.['tamano_animal'] || 'No especificado';
  }

  get condicion(): string {
    return this.rescate?.incidencia?.['condicion_animal'] || 'No especificada';
  }

  get edad(): string {
    return this.rescate?.incidencia?.['edad_estimada'] || 'No especificada';
  }

  get peso(): string {
    return this.rescate?.incidencia?.['peso_estimado'] || 'No especificado';
  }
  get color(): string {
    return (this.rescate?.incidencia?.['color_animal'] as string)?.trim() || 'No especificado';
  }

  get raza(): string {
    return (this.rescate?.incidencia?.['raza_animal'] as string)?.trim() || 'No identificada';
  }

  get agresividad(): string | null {
    return (this.rescate?.incidencia?.['agresividad_animal'] as string)?.trim() || null;
  }

  /** Como reacciona el animal: informacion de seguridad para el voluntario. */
  get avisoAgresividad(): { titulo: string; detalle: string; icono: string; clase: string; claseTexto: string } | null {
    switch (this.agresividad) {
      case 'agresivo':
        return {
          titulo: 'Agresivo',
          detalle: 'Gruñe o intenta morder. No te acerques sin equipo de contención.',
          icono: 'warning',
          clase: 'border-red-300 bg-red-50',
          claseTexto: 'text-red-800',
        };
      case 'asustadizo':
        return {
          titulo: 'Asustadizo',
          detalle: 'Huye del contacto. Acércate despacio, sin movimientos bruscos ni ruidos.',
          icono: 'directions_run',
          clase: 'border-amber-300 bg-amber-50',
          claseTexto: 'text-amber-800',
        };
      case 'docil':
        return {
          titulo: 'Dócil',
          detalle: 'Se deja acercar. Aun así, mantén precaución al manipularlo.',
          icono: 'volunteer_activism',
          clase: 'border-emerald-300 bg-emerald-50',
          claseTexto: 'text-emerald-800',
        };
      case 'no_evaluable':
        return {
          titulo: 'Sin evaluar',
          detalle: 'Nadie ha podido acercarse lo suficiente. Asume precaución máxima.',
          icono: 'help',
          clase: 'border-slate-300 bg-slate-50',
          claseTexto: 'text-slate-700',
        };
      default:
        return null;
    }
  }

  get contactoNombre(): string {
    return this.rescate?.incidencia?.nombre_contacto || 'Contacto no registrado';
  }

  get contactoTelefono(): string {
    return this.rescate?.incidencia?.telefono_contacto || 'Teléfono no registrado';
  }

  get tiempo(): string {
    const fecha = this.rescate?.fecha_aceptacion;
    if (!fecha) return 'Fecha no disponible';
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    const hrs = Math.floor(min / 60);
    const dias = Math.floor(hrs / 24);
    if (min < 1) return 'Aceptado hace segundos';
    if (min < 60) return `Aceptado hace ${min} min`;
    if (hrs < 24) return `Aceptado hace ${hrs} h`;
    return `Aceptado hace ${dias} día${dias === 1 ? '' : 's'}`;
  }

  get score(): number {
    return this.rescate?.incidencia?.urgency_score ?? 0;
  }
  
  get prioridad(): 'Urgente' | 'Alta' | 'Moderada' {
    if (this.score >= 80) return 'Urgente';
    if (this.score >= 40) return 'Alta';
    return 'Moderada';
  }

  get prioridadClase(): string {
    if (this.prioridad === 'Urgente') return 'bg-red-100 text-red-700 border-red-200';
    if (this.prioridad === 'Alta')    return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }

  get estadoLegible(): string {
    switch (this.rescate?.estado) {
      case 'EN_CAMINO':  return 'En camino';
      case 'EN_SITIO':   return 'En sitio';
      case 'COMPLETADO': return 'Rescatado';
      case 'CANCELADO':  return 'Cancelado';
      default:           return 'Aceptado';
    }
  }

  // ─────────────────────────────────────────
  // Stepper (solo lectura)
  // ─────────────────────────────────────────

  get pasoActualIndex(): number {
    switch (this.rescate?.estado) {
      case 'COMPLETADO': return 2;
      case 'EN_SITIO':   return 1;
      default:           return 0; // EN_CAMINO
    }
  }

// Evaluación del voluntario en pares {label, valor}, SIN las notas clínicas
  get evaluacionItems(): { label: string; valor: string }[] {
    const raw: string = this.rescate?.incidencia?.['ficha_voluntario']?.trim() || '';
    if (!raw) return [];
    return raw.split('|')
      .map(p => p.trim())
      .filter(p => p && !p.toLowerCase().startsWith('notas clínicas'))
      .map(p => {
        const [label, ...resto] = p.split(':');
        return { label: label.trim(), valor: resto.join(':').trim() };
      })
      .filter(x => x.valor);
  }

  // Solo las notas clínicas
  get notasClinicas(): string {
    const raw: string = this.rescate?.incidencia?.['ficha_voluntario'] || '';
    const parte = raw.split('|').map(p => p.trim()).find(p => p.toLowerCase().startsWith('notas clínicas'));
    return parte ? parte.split(':').slice(1).join(':').trim() : '';
  }

  //Saber si está rescatado
  get yaRescatado(): boolean {
    return this.
    rescate?.estado === 'COMPLETADO';
  }

  get direccion(): string {
    return this.rescate?.incidencia?.['direccion']?.trim() || '';
  }

  get fechaReporte(): string | null {
    return (this.rescate?.incidencia as any)?.created_at || null;
  }

  // Desplegable del progreso
  progresoAbierto = false;
  toggleProgreso(): void { this.progresoAbierto = !this.progresoAbierto; }

  esPasoCompletado(i: number): boolean {
    return i < this.pasoActualIndex || this.rescate?.estado === 'COMPLETADO';
  }

  esPasoActivo(i: number): boolean {
    return i === this.pasoActualIndex && this.rescate?.estado !== 'COMPLETADO';
  }

  iconoPaso(i: number): string {
    return i === 0 ? 'directions_car' : i === 1 ? 'my_location' : 'verified';
  }

  imagenUrl(imagen: string | null | undefined): string {
    if (!imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }
  // Devuelve las entradas del historial que corresponden a un paso del stepper
  entradasDePaso(i: number): { timestamp: string; nota?: string }[] {
    const estadoBackend = i === 0 ? 'EN_CAMINO' : i === 1 ? 'EN_SITIO' : 'COMPLETADO';
    return (this.rescate?.historial ?? []).filter(e => e.estado === estadoBackend);
  }

  // Control de cuál paso está expandido (null = ninguno)
  pasoExpandido: number | null = null;
  togglePaso(i: number): void {
    this.pasoExpandido = this.pasoExpandido === i ? null : i;
  }

  // ─────────────────────────────────────────
  // Navegación
  // ─────────────────────────────────────────

  actualizarCaso(): void {
    if (this.rescate) {
      this.router.navigate(['/update-case', this.rescate.incidencia?.folio]);
    }
  }

  volver(): void {
    this.router.navigate(['/accepted-cases']);
  }

  verCronologia(): void {
    if (this.rescate) {
      this.router.navigate(['/cronology-case', this.rescate.incidencia?.folio]);
    }
  }
  
  descargarCartel(): void {
    const incidencia = this.rescate?.incidencia;
    if (!incidencia || this.generandoCartel) return;
 
    this.generandoCartel = true;
    this.errorCartel = null;
 
    // OJO: NO usamos el helper imagenUrl() de este archivo para esto,
    // porque ese método siempre regresa algo (cae al placeholder local
    // 'assets/images/report-placeholder.jpg' si no hay foto) — y eso
    // era justo el bug que causaba que el cartel dibujara el ícono
    // genérico como si fuera una foto real. Aquí solo pasamos la
    // imagen si de verdad existe.
    const imagenReal = incidencia.imagen
      ? (incidencia.imagen.startsWith('http')
          ? incidencia.imagen
          : `${environment.apiUrl}${incidencia.imagen}`)
      : null;
 
    this.cartelPdf
      .descargarCartel({
        folio: incidencia.folio ?? String(incidencia.id),
        // El rescatista NUNCA es el dueño del reporte — nunca lleva el
        // talón privado con el folio de reclamo. Fijo en false, sin
        // necesidad de checar nada más (a diferencia de view-report,
        // donde sí puede ser el dueño y se usa puedeEditar()).
        incluirTalonPrivado: false,
        imagen: imagenReal ?? undefined,
        nombreCaso: incidencia.nombre_caso ?? undefined,
        tipoAnimal: incidencia.tipo_animal ?? undefined,
        tamanoAnimal: incidencia['tamano_animal'] ?? undefined,
        condicionAnimal: incidencia['condicion_animal'] ?? undefined,
        direccion: incidencia['direccion'] ?? undefined,
        notasAnimal: incidencia['notas_animal'] ?? undefined,
        nombreContacto: incidencia.nombre_contacto ?? undefined,
        telefonoContacto: incidencia.telefono_contacto ?? undefined,
      })
      .then(() => {
        this.generandoCartel = false;
      })
      .catch((err) => {
        console.error('No se pudo generar el cartel:', err);
        this.generandoCartel = false;
        this.errorCartel = 'No se pudo generar el cartel. Intenta de nuevo.';
      });
  }
}