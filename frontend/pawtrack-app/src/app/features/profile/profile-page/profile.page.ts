import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { forkJoin } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { FooterWebComponent } from 'src/app/shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';

import {
  ProfileService,
  UsuarioResponse,
  IncidenciaResponse
} from '../../../core/services/profile.service';

import { environment } from '../../../../environments/environment';

interface ReporteReciente {
  id: number;
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
    seguimientosRecientes: []
  };
  constructor(private profileService: ProfileService, private authService: AuthService) {}

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
    }).subscribe({
      next: ({ usuario, reportes }) => {
        this.usuario = this.mapearPerfil(usuario, reportes);
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el perfil. Por favor, inténtalo de nuevo más tarde.';
        this.cargando = false;
      },
    });
  }

  private mapearPerfil(usuarioBackend: UsuarioResponse, reportesBackend: IncidenciaResponse[]): UsuarioPerfil {
    const nombreCompleto = `${usuarioBackend.first_name || ''} ${usuarioBackend.last_name || ''}`.trim();

    const reportesRecientes = reportesBackend
      .slice(0, 3)
      .map((reporte) => this.mapearReporte(reporte));

    return {
      nombre: nombreCompleto || usuarioBackend.username,
      email: usuarioBackend.email,
      ubicacion: this.obtenerUbicacion(usuarioBackend),
      fotoUrl: this.resolverUrlMedia(usuarioBackend.foto_perfil, usuarioBackend.username),

      reportesTotales: reportesBackend.length,
      casosResueltos: this.obtenerCasosResueltos(usuarioBackend, reportesBackend),
      misionesAceptadas: usuarioBackend.perfil_rescatista?.misiones_completadas || 0,
      seguimientosRealizados: 0,
      nivelComunidad: this.obtenerNivelComunidad(reportesBackend.length),

      reportesRecientes,
      casosAceptadosRecientes: [],
      seguimientosRecientes: []
    };
  }

  private mapearReporte(reporte: IncidenciaResponse): ReporteReciente {
    return {
      id: reporte.id,
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

  private resolverUrlMedia(url: string | null, nombreFallback: string): string {
    if (!url) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreFallback)}&background=1d4ed8&color=fff`;
    }

    if (url.startsWith('http')) {
      return url;
    }

    return `${environment.apiUrl}${url}`;
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

  private formatearTituloReporte(reporte: IncidenciaResponse): string {
    if (reporte.tipo_incidencia) {
      return reporte.tipo_incidencia;
    }

    return `Reporte #${reporte.id}`;
  }

  private formatearLugar(reporte: IncidenciaResponse): string {
    if (reporte.lat_out !== null && reporte.lng_out !== null) {
      return `Lat: ${reporte.lat_out}, Lng: ${reporte.lng_out}`;
    }

    return 'Ubicación registrada';
  }

  private obtenerUbicacion(usuarioBackend: UsuarioResponse): string {
    if (usuarioBackend.perfil_patrocinador?.ubicacion) {
      return usuarioBackend.perfil_patrocinador.ubicacion;
    }

    return 'Ubicación no registrada';
  }

  private obtenerCasosResueltos(usuarioBackend: UsuarioResponse, reportesBackend: IncidenciaResponse[]): number {
    if (usuarioBackend.perfil_rescatista?.misiones_completadas !== undefined) {
      return usuarioBackend.perfil_rescatista.misiones_completadas;
    }

    return reportesBackend.filter((reporte) =>
      reporte.estado?.toUpperCase() === 'RESUELTO'
    ).length;
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
