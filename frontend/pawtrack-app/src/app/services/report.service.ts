import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  id:              number;
  lat_out:         number;
  lng_out:         number;
  tipo_incidencia: string;
  estado:          string;
  caracteristicas: string;
  imagen:          string | null;
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
}