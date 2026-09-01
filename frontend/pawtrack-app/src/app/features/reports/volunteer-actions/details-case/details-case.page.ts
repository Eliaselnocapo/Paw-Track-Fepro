import { SentenceCasePipe } from './../../../../shared/pipes/sentence-case-pipe';
import { AfterViewInit, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { MapaLeafletService } from '../../../../core/services/mapa-leaflet.service';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from 'src/environments/environment';
import { ReportarFraudeButtonComponent } from 'src/app/shared/components/button-fraude/reportar-fraude-button.component';
import { RevealDirective } from 'src/app/shared/directives/reveal.directive';


import * as L from 'leaflet';

interface DetalleCasoVoluntario {
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
  latitud: number | null;
  longitud: number | null;
  raw: IncidenciaResponse;
}

@Component({
  selector: 'app-details-case',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    TitleCasePipe,
    NavbarWebComponent,
    FooterWebComponent,
    ReportarFraudeButtonComponent,
    RevealDirective,
    SentenceCasePipe
  ],
  templateUrl: './details-case.page.html',
  styleUrls: ['./details-case.page.scss']
})
export class DetailsCasePage implements OnInit, AfterViewInit, OnDestroy {

  private mapa: any = null;
  caso: DetalleCasoVoluntario | null = null;
  cargando = true;
  errorCarga: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
    private auth: AuthService,
    private mapaService: MapaLeafletService
  ) {}

  ngOnInit(): void {
    this.cargarCaso();
  }

cargarCaso(): void {
  const folio = this.route.snapshot.paramMap.get('folio');

  if (!folio) {
    this.errorCarga = 'No se encontró el folio del caso.';
    this.cargando = false;
    return;
  }

  this.cargando = true;
  this.errorCarga = null;

  this.reportService.listarReportes().subscribe({
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

      const incidencia = incidencias.find(item =>
        item.folio === folio || `RPT-${item.id}` === folio
      );

      if (!incidencia) {
        this.errorCarga = 'No se encontró el caso solicitado.';
        this.caso = null;
        this.cargando = false;
        return;
      }

      this.caso = this.mapearCaso(incidencia);
      this.cargando = false;
      this.initMapa();
    },
    error: (err) => {
      console.error('ERROR CARGANDO DETALLE DEL CASO:', err);
      this.errorCarga = 'No se pudo cargar la información del caso.';
      this.caso = null;
      this.cargando = false;
    }
  });
}

  ngAfterViewInit(): void {
    // el mapa se inicializa desde cargarCaso al terminar
  }

  private initMapa(): void {
      const lat = this.caso?.latitud;
      const lng = this.caso?.longitud;
      if (this.mapa || lat == null || lng == null) return;

      setTimeout(() => {
        this.mapa = this.mapaService.crear({
          contenedorId: 'mapa-detalle-caso',
          lat, lng,
          zoom: 15,
          attributionControl: false,
          scrollWheelZoom: false,
        });

        if (!this.mapa) return;

        const icono = this.mapaService.crearIconoPin(
          '<div class="pin-detalle-inner"><span class="material-symbols-outlined">pets</span></div>',
          'pin-detalle'
        );
        L.marker([lat, lng], { icon: icono }).addTo(this.mapa);

        this.mapaService.invalidarTamano(this.mapa);
      }, 300);
    }

    ngOnDestroy(): void {
      this.mapa = this.mapaService.destruir(this.mapa);
    }

  aceptarMision(): void {
    if (!this.caso) return;

    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], {
        queryParams: {
          returnUrl: this.router.url
        }
      });
      return;
    }

    this.router.navigate(['/accept-case', this.caso.folio]);
  }

  volver(): void {
    this.router.navigate(['/dashboard/volunteer']);
  }

  private mapearCaso(incidencia: IncidenciaResponse): DetalleCasoVoluntario {
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
      latitud: incidencia.lat_out ?? null,
      longitud: incidencia.lng_out ?? null,
      raw: incidencia
    };
  }

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
      return 'Sin notas adicionales registradas por el reportante.';
    }

    return notas;
  }

  private obtenerUbicacionCaso(incidencia: IncidenciaResponse): string {
    if (incidencia.lat_out != null && incidencia.lng_out != null) {
      return `Ubicación registrada: ${incidencia.lat_out.toFixed(5)}, ${incidencia.lng_out.toFixed(5)}`;
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

  get prioridadClase(): string {
    if (!this.caso) return 'bg-slate-100 text-slate-700 border-slate-200';

    if (this.caso.prioridad === 'Urgente') {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    if (this.caso.prioridad === 'Alta') {
      return 'bg-orange-100 text-orange-700 border-orange-200';
    }

    return 'bg-blue-100 text-blue-700 border-blue-200';
  }

  get estadoLegible(): string {
    if (!this.caso?.estado) return 'Pendiente';
    return this.caso.estado.replace(/_/g, ' ').toLowerCase();
  }
  // ── Campos nuevos del animal ──────────────

  get color(): string | null {
    return this.caso?.raw?.color_animal?.trim() || null;
  }

  get raza(): string | null {
    return this.caso?.raw?.raza_animal?.trim() || null;
  }

  get agresividad(): string | null {
    return this.caso?.raw?.agresividad_animal?.trim() || null;
  }

  /** Como reacciono el animal al ver al reportante: informacion de seguridad. */
  get avisoAgresividad(): { titulo: string; detalle: string; icono: string; clase: string; claseTexto: string } | null {
    switch (this.agresividad) {
      case 'agresivo':
        return {
          titulo: 'Gruñó o intentó morder',
          detalle: 'No te acerques sin equipo de contención. Considera pedir apoyo de otro voluntario.',
          icono: 'warning',
          clase: 'border-red-300 bg-red-50',
          claseTexto: 'text-red-800',
        };
      case 'asustadizo':
        return {
          titulo: 'Se alejó o huyó',
          detalle: 'Está asustado. Acércate despacio, sin movimientos bruscos ni ruidos fuertes.',
          icono: 'directions_run',
          clase: 'border-amber-300 bg-amber-50',
          claseTexto: 'text-amber-800',
        };
      case 'docil':
        return {
          titulo: 'Se dejó acercar',
          detalle: 'El reportante pudo aproximarse sin problema. Aun así, mantén precaución.',
          icono: 'volunteer_activism',
          clase: 'border-emerald-300 bg-emerald-50',
          claseTexto: 'text-emerald-800',
        };
      case 'no_evaluable':
        return {
          titulo: 'No se pudo evaluar',
          detalle: 'El reportante lo vio de lejos. Asume precaución máxima al acercarte.',
          icono: 'help',
          clase: 'border-slate-300 bg-slate-50',
          claseTexto: 'text-slate-700',
        };
      default:
        return null;
    }
  }
  get fotoReportante(): string | null {
    const foto = this.caso?.raw?.usuario_reporta_info?.foto;
    if (!foto) return null;
    if (foto.startsWith('http')) return foto;

    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${foto}`;
  }

  get nombreReportante(): string {
    return this.caso?.raw?.usuario_reporta_info?.nombre || this.caso?.contactoNombre || 'Reportante';
  }
}
