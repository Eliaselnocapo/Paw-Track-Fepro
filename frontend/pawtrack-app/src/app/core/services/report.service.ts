import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReportePayload {
  // Paso 2 — datos del animal
  tipo_animal:       string;
  tamano_animal:     string;
  condicion_animal:  string;
  notas_animal:      string;
  // Paso 3 — ubicación
  latitud:           number;
  longitud:          number;
  // Imagen (paso 1)
  imagen?:           File;
}

export interface IncidenciaResponse {
  id:               number;
  lat_out:          number;
  lng_out:          number;
  tipo_incidencia:  string;
  estado:           string;
  caracteristicas:  string;
  imagen:           string | null;
  tipo_animal:      string | null;
  tamano_animal:    string | null;
  condicion_animal: string | null;
  edad_estimada:    string | null;
  peso_estimado:    string | null;
  urgency_score:    number;
  trust_score:      number;
  created_at:       string;
  folio:            string | null;
  usuario_reporta:  number | null;
}

export interface ActualizarReportePayload {
  estado?:          string;
  caracteristicas?: string;
  urgency_score?:   number;
  edad_estimada?:   string;
  peso_estimado?:   string;
  imagen?:          File;
}

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly apiUrl = `${environment.apiUrl}/api/incidencias/`;

  constructor(private http: HttpClient) {}

  /**
   * Crea un nuevo reporte.
   * Usa FormData para poder enviar imagen + datos de texto en un solo request multipart.
   */
  crearReporte(payload: ReportePayload): Observable<IncidenciaResponse> {
    const form = new FormData();

    form.append('tipo_animal',      payload.tipo_animal);
    form.append('tamano_animal',    payload.tamano_animal);
    form.append('condicion_animal', payload.condicion_animal);
    form.append('notas_animal',     payload.notas_animal);
    form.append('latitud',          String(payload.latitud));
    form.append('longitud',         String(payload.longitud));

    if (payload.imagen) {
      form.append('imagen', payload.imagen, payload.imagen.name);
    }

    return this.http.post<IncidenciaResponse>(this.apiUrl, form);
  }

  /**
   * Lista todos los reportes (útil para el mapa general).
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
   * Actualiza un reporte existente (PATCH — solo los campos enviados).
   * Solo el dueño o un admin pueden editar.
   */
  actualizarReporte(id: number, payload: ActualizarReportePayload): Observable<IncidenciaResponse> {
    const form = new FormData();
    if (payload.estado          != null) form.append('estado',          payload.estado);
    if (payload.caracteristicas != null) form.append('caracteristicas', payload.caracteristicas);
    if (payload.urgency_score   != null) form.append('urgency_score',   String(payload.urgency_score));
    if (payload.edad_estimada   != null) form.append('edad_estimada',   payload.edad_estimada);
    if (payload.peso_estimado   != null) form.append('peso_estimado',   payload.peso_estimado);
    if (payload.imagen)                  form.append('imagen',           payload.imagen, payload.imagen.name);
    return this.http.patch<IncidenciaResponse>(`${this.apiUrl}${id}/`, form);
  }
}