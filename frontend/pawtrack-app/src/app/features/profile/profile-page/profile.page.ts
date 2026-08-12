import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';

import {ProfileService, UsuarioResponse, IncidenciaResponse} from '../../../core/services/profile.service';

// Fuente correcta de los casos que YO acepté como rescatista.
// (la misma que usa accepted-cases y que sí funciona)
import { ReportService, RescateResponse } from '../../../core/services/report.service';

import { environment } from '../../../../environments/environment';

interface ReporteReciente {
  id: number;
  folio: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  lugar: string;
  estado: string;
  fotoUrl: string;
}

interface UsuarioPerfil {
  nombre: string;
  email: string;
  ubicacion: string;
  fotoUrl: string;

  reportesTotales: number;
  casosResueltos: number;
  misionesAceptadas: number;
  seguimientosRealizados: number;
  nivelComunidad: string;

  reportesRecientes: ReporteReciente[];
  casosAceptadosRecientes: ReporteReciente[];
  seguimientosRecientes: ReporteReciente[];

  centroApoyo: {
    id: number;
    nombre: string;
    estado: string;
    tipo: string;
    direccion: string;
    logoUrl: string | null;
  } | null
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    FooterWebComponent,
    NavbarWebComponent
  ],
})
export class ProfilePage implements OnInit {

  tabActividad: 'reportes' | 'aceptados' | 'seguimientos' = 'reportes';

  esPantallaGrande = window.innerWidth >= 768;

  cargando = true;
  error = '';

  usuario: UsuarioPerfil = {
    nombre: '',
    email: '',
    ubicacion: 'Ubicación no registrada',
    fotoUrl: 'https://ui-avatars.com/api/?name=Usuario&background=1d4ed8&color=fff',

    reportesTotales: 0,
    casosResueltos: 0,
    misionesAceptadas: 0,
    seguimientosRealizados: 0,
    nivelComunidad: 'Comunidad inicial',

    reportesRecientes: [],
    casosAceptadosRecientes: [],
    seguimientosRecientes: [],
    centroApoyo: null
  };

  constructor(
    private profileService: ProfileService,
    private authService: AuthService,
    private reportService: ReportService,
  ) {}

  private getUserIdFromToken(): number | null {
    const token = localStorage.getItem('pawtrack_access');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id ?? null;
    } catch { return null; }
  }

  ngOnInit(): void {
    this.cargarPerfil();
  }

  @HostListener('window:resize')
  onResize() {
    this.esPantallaGrande = window.innerWidth >= 768;
  }

  cargarPerfil(): void {
    this.cargando = true;
    this.error = '';

    const userId = this.getUserIdFromToken();
    if (!userId) {
      this.error = 'Debes iniciar sesión para ver tu perfil.';
      this.cargando = false;
      return;
    }

    forkJoin({
      usuario: this.profileService.obtenerUsuario(userId),
      reportes: this.profileService.obtenerMisCasos(),
      // Si el usuario NO es rescatista, el back responde 403.
      // El catchError evita que eso tumbe todo el perfil: cae a lista vacía.
      rescates: this.reportService.listarMisRescates().pipe(
        catchError(() => of({ count: 0, next: null, previous: null, results: [] as RescateResponse[] })),
      ),
    }).subscribe({
      next: ({ usuario, reportes, rescates }) => {
        this.usuario = this.mapearPerfil(usuario, reportes, rescates.results);
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el perfil. Por favor, inténtalo de nuevo más tarde.';
        this.cargando = false;
      },
    });
  }

  private mapearPerfil(
    usuarioBackend: UsuarioResponse,
    reportesBackend: IncidenciaResponse[],
    rescatesBackend: RescateResponse[],
  ): UsuarioPerfil {
    const nombreCompleto = `${usuarioBackend.first_name || ''} ${usuarioBackend.last_name || ''}`.trim();

    const reportesRecientes = reportesBackend
      .slice(0, 3)
      .map((reporte) => this.mapearReporte(reporte));

    // Casos aceptados = todos mis rescates.
    // Casos resueltos = solo los que ya cerré (COMPLETADO).
    const aceptados = rescatesBackend
      .filter((r) => r.estado !== 'CANCELADO')
      .map((r) => this.mapearRescate(r));
    const resueltos = rescatesBackend
      .filter((r) => r.estado === 'COMPLETADO')
      .map((r) => this.mapearRescate(r));

    return {
      nombre: nombreCompleto || usuarioBackend.username,
      email: usuarioBackend.email,
      ubicacion: this.obtenerUbicacion(usuarioBackend),
      fotoUrl: this.resolverUrlMedia(usuarioBackend.foto_perfil, usuarioBackend.username),

      reportesTotales: reportesBackend.length,
      casosResueltos: this.obtenerCasosResueltos(usuarioBackend, reportesBackend, resueltos.length),
      misionesAceptadas: aceptados.length,
      seguimientosRealizados: resueltos.length,
      nivelComunidad: this.obtenerNivelComunidad(reportesBackend.length),

      reportesRecientes,
      casosAceptadosRecientes: aceptados.slice(0, 3),
      seguimientosRecientes: resueltos.slice(0, 3),
      centroApoyo: usuarioBackend.perfil_patrocinador
      ? {
          id: usuarioBackend.perfil_patrocinador.id,
          nombre: usuarioBackend.perfil_patrocinador.nombre,
          estado: usuarioBackend.perfil_patrocinador.estado,
          tipo: usuarioBackend.perfil_patrocinador.tipo,
          direccion: usuarioBackend.perfil_patrocinador.direccion,
          logoUrl: usuarioBackend.perfil_patrocinador.logo
            ? this.resolverUrlMedia(usuarioBackend.perfil_patrocinador.logo, usuarioBackend.perfil_patrocinador.nombre)
            : null,
        }
      : null,
      };
  }

  private mapearReporte(reporte: IncidenciaResponse): ReporteReciente {
    return {
      id: reporte.id,
      folio: (reporte as any).folio ?? `RPT-${reporte.id}`,
      titulo: this.formatearTituloReporte(reporte),
      descripcion: reporte.caracteristicas || 'Sin descripción registrada.',
      fecha: 'Sin fecha',
      lugar: this.formatearLugar(reporte),
      estado: this.formatearEstado(reporte.estado),
      fotoUrl: this.resolverUrlMedia(
        reporte.imagen,
        `Reporte ${reporte.id}`
      )
    };
  }

  private mapearRescate(r: RescateResponse): ReporteReciente {
    const i = r.incidencia;
    return {
      id: i.id,
      folio: i.folio ?? `RPT-${i.id}`,
      titulo: i.nombre_caso?.trim() || `${i.tipo_animal ?? 'Animal'} en incidencia`,
      descripcion: (i['notas_animal'] as string)?.trim() || 'Sin descripción registrada.',
      fecha: this.formatearFechaRelativa(r.fecha_aceptacion),
      lugar: this.formatearLugarRescate(i),
      estado: this.formatearEstadoRescate(r.estado),
      fotoUrl: this.resolverUrlMedia(i.imagen, i.nombre_caso || `Caso ${i.id}`),
    };
  }

  private resolverUrlMedia(url: string | null, nombreFallback: string): string {
    if (!url) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreFallback)}&background=1d4ed8&color=fff`;
    }

    if (url.startsWith('http')) {
      return url;
    }

    // Las imágenes se sirven desde /media/, no bajo /api/
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${url}`;
  }

  private formatearRol(rol: string): string {
    const roles: Record<string, string> = {
      REPORTERO: 'Reportero',
      RESCATISTA: 'Rescatista',
      PATROCINADOR: 'Patrocinador'
    };

    return roles[rol] || rol;
  }

  private formatearEstado(estado: string): string {
    const estadoNormalizado = (estado || '').toUpperCase();

    const estados: Record<string, string> = {
      PENDIENTE: 'Urgente',
      EN_PROCESO: 'En proceso',
      EN_REVISION: 'En revisión',
      RESUELTO: 'Resuelto'
    };

    return estados[estadoNormalizado] || estado;
  }

  // Estado del RESCATE (no de la incidencia): EN_CAMINO / EN_SITIO / COMPLETADO / CANCELADO
  private formatearEstadoRescate(estado: string): string {
    const estados: Record<string, string> = {
      EN_CAMINO:  'En camino',
      EN_SITIO:   'En sitio',
      COMPLETADO: 'Rescatado',
      CANCELADO:  'Cancelado',
    };
    return estados[estado] || estado;
  }

  private formatearTituloReporte(reporte: IncidenciaResponse): string {
    const nombreCaso = (reporte as any).nombre_caso?.trim();
    if (nombreCaso) return nombreCaso;

    const tipoAnimal = (reporte as any).tipo_animal;
    if (tipoAnimal) return `${tipoAnimal} en incidencia`;

    if (reporte.tipo_incidencia) return reporte.tipo_incidencia;

    return `Reporte #${reporte.id}`;
  }

  // Prefiere la direccion guardada; cae a coords y luego a texto genérico.
  private formatearLugar(reporte: IncidenciaResponse): string {
    const direccion = (reporte as any).direccion;
    if (typeof direccion === 'string' && direccion.trim()) {
      return direccion.trim();
    }

    if (reporte.lat_out !== null && reporte.lng_out !== null) {
      return `${reporte.lat_out}, ${reporte.lng_out}`;
    }

    return 'Ubicación registrada';
  }

  // Igual que el anterior pero para la incidencia embebida en un rescate.
  private formatearLugarRescate(i: any): string {
    if (i?.direccion && typeof i.direccion === 'string' && i.direccion.trim()) {
      return i.direccion.trim();
    }

    if (i?.lat_out != null && i?.lng_out != null) {
      return `${Number(i.lat_out).toFixed(5)}, ${Number(i.lng_out).toFixed(5)}`;
    }

    return 'Ubicación no disponible';
  }

  private formatearFechaRelativa(fecha: string | null | undefined): string {
    if (!fecha) return 'Sin fecha';
    const diff = Date.now() - new Date(fecha).getTime();
    const min  = Math.floor(diff / 60000);
    const hrs  = Math.floor(min / 60);
    const dias = Math.floor(hrs / 24);
    if (min < 1)  return 'Hace un momento';
    if (min < 60) return `Hace ${min} min`;
    if (hrs < 24) return `Hace ${hrs} h`;
    return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
  }

  private obtenerUbicacion(usuarioBackend: UsuarioResponse): string {
    // El back agregó 'ubicacion' directo en el modelo Usuario (migración 0015).
    const ubicacion = (usuarioBackend as any).ubicacion;
    if (typeof ubicacion === 'string' && ubicacion.trim()) {
      return ubicacion.trim();
    }

    if (usuarioBackend.perfil_patrocinador?.ubicacion) {
      return usuarioBackend.perfil_patrocinador.ubicacion;
    }

    return 'Ubicación no registrada';
  }

  private obtenerCasosResueltos(
    usuarioBackend: UsuarioResponse,
    reportesBackend: IncidenciaResponse[],
    resueltosRescate: number,
  ): number {
    // Preferimos el conteo real de rescates COMPLETADO;
    // si el back trae misiones_completadas, usamos el mayor de los dos.
    if (usuarioBackend.perfil_rescatista?.misiones_completadas !== undefined) {
      return Math.max(usuarioBackend.perfil_rescatista.misiones_completadas, resueltosRescate);
    }

    const porEstado = reportesBackend.filter((reporte) =>
      reporte.estado?.toUpperCase() === 'RESUELTO'
    ).length;

    return Math.max(porEstado, resueltosRescate);
  }

  cerrarSesion() {
    this.authService.logout();
  }

  private obtenerNivelComunidad(totalReportes: number): string {
    if (totalReportes >= 10) return 'Aliado comunitario';
    if (totalReportes >= 5) return 'Colaborador activo';
    if (totalReportes >= 1) return 'Primer apoyo registrado';

    return 'Comunidad inicial';
  }
}