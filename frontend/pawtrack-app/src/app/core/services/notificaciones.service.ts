import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

export type TipoNotificacion =
  | 'reporte_aceptado'
  | 'reporte_cerrado'
  | 'reporte_cancelado'
  | 'centro_publicacion'
  | 'centro_aprobado'
  | 'centro_rechazado';

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  enlace: string;
  leida: boolean;
  created_at: string;
}

interface Paginado<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notificaciones/`;

  /** Contador para el badge. Es signal para que la campanita se actualice
   *  sola desde cualquier parte de la app sin pasar el valor por inputs. */
  readonly noLeidas = signal(0);

  private get haySesion(): boolean {
    return !!localStorage.getItem('pawtrack_access');
  }

  listar(soloNoLeidas = false): Observable<Paginado<Notificacion>> {
    const url = soloNoLeidas ? `${this.baseUrl}?no_leidas=1` : this.baseUrl;
    return this.http.get<Paginado<Notificacion>>(url);
  }

  /** Refresca el contador. Sin sesión no se llama: daría 401. */
  refrescarContador(): void {
    if (!this.haySesion) {
      this.noLeidas.set(0);
      return;
    }

    this.http.get<{ no_leidas: number }>(`${this.baseUrl}no-leidas/`).subscribe({
      next: (r) => this.noLeidas.set(r.no_leidas),
      error: () => this.noLeidas.set(0),
    });
  }

  marcarLeida(id: number): Observable<Notificacion> {
    return this.http
      .patch<Notificacion>(`${this.baseUrl}${id}/leer/`, {})
      .pipe(tap(() => this.noLeidas.update((n) => Math.max(0, n - 1))));
  }

  marcarTodasLeidas(): Observable<{ marcadas: number }> {
    return this.http
      .post<{ marcadas: number }>(`${this.baseUrl}leer-todas/`, {})
      .pipe(tap(() => this.noLeidas.set(0)));
  }

  /** Suma uno al contador cuando llega una notificación por WebSocket. */
  incrementarContador(): void {
    this.noLeidas.update((n) => n + 1);
  }

  /** Ícono de Material Symbols según el tipo. */
  icono(tipo: TipoNotificacion): string {
    switch (tipo) {
      case 'reporte_aceptado':   return 'volunteer_activism';
      case 'reporte_cerrado':    return 'verified';
      case 'reporte_cancelado':  return 'undo';
      case 'centro_publicacion': return 'campaign';
      case 'centro_aprobado':    return 'verified_user';
      case 'centro_rechazado':   return 'cancel';
      default:                   return 'notifications';
    }
  }

  /** Color del ícono. Devuelve la cadena completa para que Tailwind la
   *  encuentre en el escaneo (las clases armadas por concatenación no se
   *  generan). */
  colorIcono(tipo: TipoNotificacion): string {
    switch (tipo) {
      case 'reporte_cerrado':
      case 'centro_aprobado':
        return 'bg-emerald-50 text-emerald-600';
      case 'reporte_cancelado':
      case 'centro_rechazado':
        return 'bg-red-50 text-red-600';
      default:
        return 'bg-blue-50 text-blue-600';
    }
  }

  /** "Hace 5 min", "Hace 2 h", "Hace 3 días". */
  tiempoRelativo(fecha: string): string {
    const ms = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(ms / 60000);
    const hrs = Math.floor(min / 60);
    const dias = Math.floor(hrs / 24);

    if (min < 1) return 'Ahora';
    if (min < 60) return `Hace ${min} min`;
    if (hrs < 24) return `Hace ${hrs} h`;
    if (dias < 7) return `Hace ${dias} día${dias === 1 ? '' : 's'}`;

    return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }
}