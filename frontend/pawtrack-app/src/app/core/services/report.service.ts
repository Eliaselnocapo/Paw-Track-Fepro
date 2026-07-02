import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ReportePayload {
  nombre_caso: string;
  tipo_animal: string;
  tamano_animal: string;
  condicion_animal: string;
  notas_animal: string;
  latitud: number;
  longitud: number;
  imagen?: File;
  nombre_contacto?: string;
  telefono_contacto?: string;
}

export interface IncidenciaResponse {
  id:                number;
  nombre_caso:       string | null;
  nombre_contacto:   string | null;
  telefono_contacto: string | null;
  lat_out:           number;
  lng_out:           number;
  tipo_incidencia:   string;
  estado:            string;
  caracteristicas:   string;
  imagen:            string | null;
  tipo_animal:       string | null;
  tamano_animal:     string | null;
  condicion_animal:  string | null;
  notas_animal:      string | null;
  edad_estimada:     string | null;
  peso_estimado:     string | null;
  urgency_score:     number;
  trust_score:       number;
  created_at:        string;
  updated_at?:       string | null;
  folio:             string | null;
  usuario_reporta:   number | null;
}

export interface ActualizarReportePayload {
  nombre_caso?:      string;
  tipo_animal?:      string;
  tamano_animal?:    string;
  condicion_animal?: string;
  notas_animal?:     string;
  latitud?:          number;
  longitud?:         number;
  estado?:           string;
  caracteristicas?:  string;
  urgency_score?:    number;
  edad_estimada?:    string;
  peso_estimado?:    string;
  imagen?:           File;
  nombre_contacto?:  string;
  telefono_contacto?:string;
  lat_out?:          number;
  lng_out?:          number;
}

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly apiUrl = `${environment.apiUrl}/incidencias/`;

  constructor(private http: HttpClient) {}

  /**
   * Crea un nuevo reporte.
   * Usa FormData para poder enviar imagen + datos de texto en un solo request multipart.
   */
  crearReporte(payload: ReportePayload): Observable<IncidenciaResponse> {
    const form = new FormData();

    form.append('nombre_caso',      payload.nombre_caso);
    form.append('tipo_animal',      payload.tipo_animal);
    form.append('tamano_animal',    payload.tamano_animal);
    form.append('condicion_animal', payload.condicion_animal);
    form.append('notas_animal',     payload.notas_animal);
    form.append('latitud',          String(payload.latitud));
    form.append('longitud',         String(payload.longitud));

    if (payload.imagen)            form.append('imagen',             payload.imagen, payload.imagen.name);
    if (payload.nombre_contacto)   form.append('nombre_contacto',   payload.nombre_contacto);
    if (payload.telefono_contacto) form.append('telefono_contacto', payload.telefono_contacto);

    return this.http.post<IncidenciaResponse>(this.apiUrl, form);
  }

  /**
   * Lista todos los reportes (útil para el mapa general y el dashboard de voluntario).
   */
  listarReportes(): Observable<IncidenciaResponse[]> {
    return this.http.get<IncidenciaResponse[]>(this.apiUrl);
  }

  /**
   * Obtiene un reporte por su ID.
   */
  obtenerReporte(id: number): Observable<IncidenciaResponse> {
    return this.http.get<IncidenciaResponse>(`${this.apiUrl}${id}/`);
  }

  /**
   * Lista solo los reportes del usuario autenticado.
   * Requiere token JWT (enviado automáticamente por el interceptor).
   */
  listarMisCasos(): Observable<IncidenciaResponse[]> {
    return this.http.get<IncidenciaResponse[]>(`${this.apiUrl}mis-casos/`);
  }

  /**
   * Obtiene un reporte por su folio (ej. "PT-2024-0001").
   */
  obtenerReportePorFolio(folio: string): Observable<IncidenciaResponse> {
    return this.http.get<IncidenciaResponse>(`${this.apiUrl}folio/${folio}/`);
  }

  /**
   * Acepta un caso como voluntario.
   *
   * ESTADO ACTUAL: simulado — devuelve un observable vacío con delay
   * para no romper el flujo mientras el back no tiene el endpoint.
   *
   * CUANDO EL BACK ESTÉ LISTO, hay dos opciones:
   *
   * ── Opción A (recomendada): endpoint dedicado ────────────────────────
   * El back crea POST /incidencias/{id}/aceptar/ que:
   *   1. Cambia estado a ASIGNADO
   *   2. Registra al voluntario autenticado como responsable
   *   3. Evita race conditions si dos voluntarios intentan al mismo tiempo
   *
   * Descomentar:
   *   return this.http.post<IncidenciaResponse>(`${this.apiUrl}${id}/aceptar/`, {});
   * Comentar el bloque "SIMULADO" de abajo.
   *
   * ── Opción B (mientras no hay endpoint dedicado): PATCH directo ──────
   * Usa actualizarReporte() que ya existe. Funciona si el back
   * permite que cualquier usuario autenticado haga PATCH al estado.
   * OJO: no registra al voluntario ni protege race conditions.
   *
   * Descomentar:
   *   return this.actualizarReporte(id, { estado: 'ASIGNADO' });
   * Comentar el bloque "SIMULADO" de abajo.
   * ─────────────────────────────────────────────────────────────────────
   */
  aceptarCaso(id: number): Observable<IncidenciaResponse | null> {
    // ── SIMULADO ─────────────────────────────────────────────────────────
    // Devuelve null con un pequeño delay para simular la latencia de red.
    // El componente accept-case.page.ts ya maneja el null correctamente.
    // Eliminar este return cuando el back esté listo.
    return of(null).pipe(delay(800));
    // ─────────────────────────────────────────────────────────────────────

    // ── OPCIÓN A: endpoint dedicado (recomendado) ─────────────────────────
    // return this.http.post<IncidenciaResponse>(`${this.apiUrl}${id}/aceptar/`, {});
    // ─────────────────────────────────────────────────────────────────────

    // ── OPCIÓN B: PATCH directo al estado ────────────────────────────────
    // return this.actualizarReporte(id, { estado: 'ASIGNADO' });
    // ─────────────────────────────────────────────────────────────────────
  }

  /**
   * Actualiza un reporte existente (PATCH — solo los campos enviados).
   * Solo el dueño o un admin pueden editar.
   */
  actualizarReporte(id: number, payload: ActualizarReportePayload): Observable<IncidenciaResponse> {
    const form = new FormData();

    if (payload.nombre_caso      != null) form.append('nombre_caso',      payload.nombre_caso);
    if (payload.tipo_animal      != null) form.append('tipo_animal',      payload.tipo_animal);
    if (payload.tamano_animal    != null) form.append('tamano_animal',    payload.tamano_animal);
    if (payload.condicion_animal != null) form.append('condicion_animal', payload.condicion_animal);
    if (payload.notas_animal     != null) form.append('notas_animal',     payload.notas_animal);
    if (payload.latitud          != null) form.append('latitud',          String(payload.latitud));
    if (payload.longitud         != null) form.append('longitud',         String(payload.longitud));
    if (payload.estado           != null) form.append('estado',           payload.estado);
    if (payload.caracteristicas  != null) form.append('caracteristicas',  payload.caracteristicas);
    if (payload.urgency_score    != null) form.append('urgency_score',    String(payload.urgency_score));
    if (payload.edad_estimada    != null) form.append('edad_estimada',    payload.edad_estimada);
    if (payload.peso_estimado    != null) form.append('peso_estimado',    payload.peso_estimado);
    if (payload.nombre_contacto  != null) form.append('nombre_contacto',  payload.nombre_contacto);
    if (payload.telefono_contacto!= null) form.append('telefono_contacto',payload.telefono_contacto);
    if (payload.lat_out          != null) form.append('lat_out',          String(payload.lat_out));
    if (payload.lng_out          != null) form.append('lng_out',          String(payload.lng_out));

    if (payload.imagen) form.append('imagen', payload.imagen, payload.imagen.name);

    return this.http.patch<IncidenciaResponse>(`${this.apiUrl}${id}/`, form);
  }
}