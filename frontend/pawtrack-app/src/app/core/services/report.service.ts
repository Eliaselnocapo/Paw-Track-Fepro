import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Estados posibles de una Incidencia (el reporte). */
export type EstadoIncidencia = 'PENDIENTE' | 'ATENDIENDOSE' | 'CERRADO';

/**
 * Estados posibles de un Rescate (la "misión" del rescatista).
 * EN_SITIO es el paso intermedio que el back agregó (En camino → En sitio → Rescatado).
 */
export type EstadoRescate = 'EN_CAMINO' | 'EN_SITIO' | 'COMPLETADO' | 'CANCELADO';

export interface ReportePayload {
  nombre_caso: string;
  tipo_animal: string;
  tamano_animal: string;
  condicion_animal: string;
  notas_animal: string;
  color_animal?: string;
  raza_animal?: string;
  agresividad_animal?: string;
  latitud: number;
  longitud: number;
  direccion?: string;
  imagen?: File;
  nombre_contacto?: string;
  telefono_contacto?: string;
  /** Folio del candidato que verificarDuplicado() encontró en el paso 4 del
   * wizard, si el reportante ya respondió la pregunta "¿es el mismo caso?"
   * antes de enviar. Ver ReportService.verificarDuplicado(). */
  duplicado_candidato_folio?: string;
  /** true si el reportante confirmó que es el mismo caso (el back borra
   * el reporte nuevo de inmediato, sin tocar el caso original — ver
   * DuplicadoDescartadoResponse), false si dijo que es distinto (queda
   * como registro de auditoría, el reporte se crea como caso independiente). */
  duplicado_confirmado?: boolean;
  /** Score que regresó verificarDuplicado() para ese candidato, solo para
   * el registro de auditoría (SugerenciaDuplicado) del lado del back. */
  duplicado_score?: number;
}

/**
 * Respuesta cuando el reportante confirmó en el paso 4 que era el mismo
 * caso: el back borra el reporte nuevo por completo (ver
 * deduplicacion.services.descartar_duplicado) y no crea ninguna
 * Incidencia — no hay folio de seguimiento propio, solo el del caso
 * existente al que ya se atendió.
 */
export interface DuplicadoDescartadoResponse {
  duplicado_descartado: true;
  folio_existente: string;
}

/** Info del rescatista asignado que devuelve el serializer cuando el caso ya fue tomado. */
export interface RescatistaInfo {
  id: number;
  nombre: string;
  email: string;
}

export interface SeguimientoHistorial {
  folio: string;
  estado: string;
  historial: EntradaHistorial[];
}

/**
 * Candidato a duplicado que verificarDuplicado() encontró para los datos que
 * el reportante lleva capturados hasta el paso 4 del wizard (imagen +
 * tipo/tamaño/color/raza + ubicación). No hay Incidencia nueva creada
 * todavía en este punto — es el "otro" reporte ya existente que se parece.
 */
export interface CandidatoDuplicado {
  score: number;
  folio: string | null;
  tipo_animal: string | null;
  imagen: string | null;
  created_at: string;
}

export interface VerificarDuplicadoPayload {
  tipo_animal: string;
  tamano_animal?: string;
  color_animal?: string;
  raza_animal?: string;
  latitud: number;
  longitud: number;
  imagen: File;
}

export interface SeguimientoResponse {
  folio: string;
  estado: string;
  tipo_incidencia: string;
  urgency_score: number;
  created_at: string;
  rescatista_asignado: boolean;
  tipo_animal: string | null;
}

export interface IncidenciaResponse {
  id:                  number;
  usuario_reporta:     number | null;
  animal:              number | null;
  patrocinador:        number | null;
  rescatista_asignado: number | null;
  rescatista_info:     RescatistaInfo | null;
  imagen:              string | null;
  lat_out:             number | null;
  lng_out:             number | null;
  direccion:           string;
  tipo_animal:         string | null;
  tamano_animal:       string | null;
  condicion_animal:    string | null;
  notas_animal:        string | null;
  edad_estimada:       string | null;
  peso_estimado:       string | null;
  color_animal:        string | null;
  raza_animal:         string | null;
  agresividad_animal:  string | null;
  nombre_caso:         string | null;
  nombre_contacto:     string | null;
  telefono_contacto:   string | null;
  caracteristicas:     string;
  estado:              EstadoIncidencia | string;
  tipo_incidencia:     string;
  recompensa:          number | null;
  urgency_score:       number;
  trust_score:         number;
  created_at:          string;
  updated_at?:         string | null;
  folio:               string | null;
  ficha_voluntario?: string;
}

export interface ActualizarReportePayload {
  nombre_caso?:      string;
  tipo_animal?:      string;
  tamano_animal?:    string;
  condicion_animal?: string;
  notas_animal?:     string;
  latitud?:          number;
  longitud?:         number;
  direccion?:        string;
  estado?:           EstadoIncidencia | string;
  caracteristicas?:  string;
  color_animal?:       string;
  raza_animal?:        string;
  agresividad_animal?: string;
  urgency_score?:    number;
  edad_estimada?:    string;
  peso_estimado?:    string;
  imagen?:           File;
  nombre_contacto?:  string;
  telefono_contacto?:string;
  lat_out?:          number;
  lng_out?:          number;
  ficha_voluntario?: string;
}

/**
 * Respuesta estándar de mensaje del back para las acciones de rescate.
 * (aceptar / actualizar-estado / cerrar devuelven esto, NO una IncidenciaResponse).
 */
export interface MensajeResponse {
  code:         string;
  detail:       string;
  field_errors: Record<string, string[]>;
}

/** Una entrada del historial/cronología de un rescate. */
export interface EntradaHistorial {
  estado:    string;
  timestamp: string;
  nota?:     string;
  motivo?:   string;
  ubicacion_cierre?: { lat: number; lng: number };
  foto_cierre?: string | null;
}

/**
 * Incidencia embebida dentro de un Rescate (la que devuelven mis-rescates
 * y el detalle de rescate). Es un subconjunto de IncidenciaResponse.
 */
export interface IncidenciaEnRescate {
  id:                number;
  folio:             string | null;
  nombre_caso:       string | null;
  estado:            EstadoIncidencia | string;
  lat_out:           number | null;
  lng_out:           number | null;
  imagen:            string | null;
  tipo_animal:       string | null;
  urgency_score:     number;
  nombre_contacto:   string | null;
  telefono_contacto: string | null;
  // El back manda "resto de campos de IncidenciaSerializer", así que dejamos
  // pasar cualquier campo extra sin romper el tipado.
  [key: string]: any;
}

/**
 * Respuesta de GET /rescates/mis-rescates/ (cada item) y de GET /rescates/{id}/.
 * Este es el objeto que trae el rescate_id que necesitamos para todo lo demás.
 */
export interface RescateResponse {
  rescate_id:       number;
  estado:           EstadoRescate | string;
  historial:        EntradaHistorial[];
  fecha_aceptacion: string | null;
  fecha_cierre:     string | null;
  incidencia:       IncidenciaEnRescate;
}

/** Envoltura de paginación de DRF (PageNumberPagination). */
export interface Paginated<T> {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  T[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICIO
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  /** CRUD de reportes: /api/incidencias/ */
  private readonly apiUrl = `${environment.apiUrl}/incidencias/`;

  /** Acciones de rescatista: /api/rescates/ */
  private readonly rescatesUrl = `${environment.apiUrl}/rescates/`;

  constructor(private http: HttpClient) {}

  // ───────────────────────────── REPORTES (REPORTERO) ─────────────────────────

  /**
   * Crea un nuevo reporte.
   * Usa FormData para enviar imagen + datos de texto en un solo request multipart.
   * El back lo crea en estado PENDIENTE por defecto.
   */
  crearReporte(payload: ReportePayload): Observable<IncidenciaResponse | DuplicadoDescartadoResponse> {
    const form = new FormData();

    form.append('nombre_caso',      payload.nombre_caso);
    form.append('tipo_animal',      payload.tipo_animal);
    form.append('tamano_animal',    payload.tamano_animal);
    form.append('condicion_animal', payload.condicion_animal);
    form.append('notas_animal',     payload.notas_animal);
    form.append('latitud',          String(payload.latitud));
    form.append('longitud',         String(payload.longitud));

    if (payload.color_animal)       form.append('color_animal',       payload.color_animal);
    if (payload.raza_animal)        form.append('raza_animal',        payload.raza_animal);
    if (payload.agresividad_animal) form.append('agresividad_animal', payload.agresividad_animal);
    if (payload.direccion)          form.append('direccion',          payload.direccion);
    if (payload.imagen)             form.append('imagen',             payload.imagen, payload.imagen.name);
    if (payload.nombre_contacto)    form.append('nombre_contacto',    payload.nombre_contacto);
    if (payload.telefono_contacto)  form.append('telefono_contacto',  payload.telefono_contacto);

    if (payload.duplicado_candidato_folio) form.append('duplicado_candidato_folio', payload.duplicado_candidato_folio);
    if (payload.duplicado_confirmado != null) form.append('duplicado_confirmado', String(payload.duplicado_confirmado));
    if (payload.duplicado_score != null) form.append('duplicado_score', String(payload.duplicado_score));

    return this.http.post<IncidenciaResponse | DuplicadoDescartadoResponse>(this.apiUrl, form);
  }

  /**
   * Chequeo síncrono de posibles duplicados — pensado para llamarse en el
   * paso 4 del wizard de reporte (revisión final), ANTES de crear nada.
   * Manda la imagen + los metadatos ya capturados hasta ese punto y regresa
   * el candidato más parecido si supera el umbral del back, o
   * `{ candidato: null }` si no hay nada parecido cerca.
   *
   * Si el usuario confirma que es el mismo caso, el folio + score del
   * candidato se reenvían dentro de crearReporte() (campos
   * `duplicado_candidato_folio`/`duplicado_confirmado`/`duplicado_score`)
   * para que el back borre el reporte nuevo en el mismo request en vez de
   * crearlo (ver DuplicadoDescartadoResponse).
   */
  verificarDuplicado(payload: VerificarDuplicadoPayload): Observable<{ candidato: CandidatoDuplicado | null }> {
    const form = new FormData();
    form.append('tipo_animal', payload.tipo_animal);
    if (payload.tamano_animal) form.append('tamano_animal', payload.tamano_animal);
    if (payload.color_animal)  form.append('color_animal',  payload.color_animal);
    if (payload.raza_animal)   form.append('raza_animal',   payload.raza_animal);
    form.append('latitud',  String(payload.latitud));
    form.append('longitud', String(payload.longitud));
    form.append('imagen', payload.imagen, payload.imagen.name);

    return this.http.post<{ candidato: CandidatoDuplicado | null }>(`${this.apiUrl}verificar-duplicado/`, form);
  }

  /**
   * Lista TODOS los reportes (AllowAny). Útil para el mapa general.
   * OJO: para el dashboard de voluntario usa listarCasosDisponibles();
   * para "mis casos aceptados" usa listarMisRescates().
   */
  listarReportes(): Observable<IncidenciaResponse[]> {
    return this.http.get<IncidenciaResponse[]>(this.apiUrl);
  }

  /** Obtiene un reporte por su ID. */
  obtenerReporte(id: number): Observable<IncidenciaResponse> {
    return this.http.get<IncidenciaResponse>(`${this.apiUrl}${id}/`);
  }

  seguimientoHistorialPorFolio(folio: string) {
    return this.http.get<SeguimientoHistorial>(
      `${this.apiUrl.replace('/incidencias/', '/incidencias/')}seguimiento/${folio}/historial/`
    );
  }
  /**
   * Lista solo los reportes del usuario autenticado (los que YO reporté).
   * Requiere token JWT (lo agrega el interceptor).
   */
  listarMisCasos(): Observable<IncidenciaResponse[]> {
    return this.http.get<IncidenciaResponse[]>(`${this.apiUrl}mis-casos/`);
  }

  /** Obtiene un reporte por su folio (ej. "REG-EMG-00042"). */
  obtenerReportePorFolio(folio: string): Observable<IncidenciaResponse> {
    return this.http.get<IncidenciaResponse>(`${this.apiUrl}folio/${folio}/`);
  }

  /**
   * Seguimiento público de un reporte por folio (AllowAny).
   * Pensado para la pantalla "ver seguimiento" del reportante una vez que su
   * caso fue tomado (ya no puede editarlo, solo seguirlo).
   * Devuelve estado, tipo, urgency_score, created_at y si ya tiene rescatista.
   */
  seguimientoPorFolio(folio: string): Observable<SeguimientoResponse> {
    return this.http.get<SeguimientoResponse>(`${this.apiUrl}seguimiento/${folio}/`);
  }

  /**
   * Actualiza un reporte existente (PATCH — solo los campos enviados).
   * Solo el autor (mientras esté PENDIENTE) o el rescatista asignado pueden editar.
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
    if (payload.direccion        != null) form.append('direccion',        payload.direccion);
    if (payload.color_animal       != null) form.append('color_animal',       payload.color_animal);
    if (payload.raza_animal        != null) form.append('raza_animal',        payload.raza_animal);
    if (payload.agresividad_animal != null) form.append('agresividad_animal', payload.agresividad_animal);
    if (payload.estado           != null) form.append('estado',           payload.estado);
    if (payload.caracteristicas  != null) form.append('caracteristicas',  payload.caracteristicas);
    if (payload.ficha_voluntario != null) form.append('ficha_voluntario', payload.ficha_voluntario);
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

  // ───────────────────────────── RESCATE (RESCATISTA) ─────────────────────────

  /**
   * Lista los casos DISPONIBLES para el rescatista logueado.
   *
   * GET /api/rescates/disponibles/?lat=..&lng=..
   *  - Requiere rol RESCATISTA (IsRescatista) → si no, 403.
   *  - lat y lng OBLIGATORIOS → si faltan, 400.
   *  - Solo incidencias PENDIENTE dentro de 10 km, ordenadas por urgency_score.
   *  - PAGINADO: { count, next, previous, results: [...] }.
   */
  listarCasosDisponibles(lat: number, lng: number): Observable<Paginated<IncidenciaResponse>> {
    const params = new HttpParams()
      .set('lat', String(lat))
      .set('lng', String(lng));

    return this.http.get<Paginated<IncidenciaResponse>>(`${this.rescatesUrl}disponibles/`, { params });
  }

  /**
   * Lista los rescates que YO acepté (como rescatista).
   *
   * GET /api/rescates/mis-rescates/  (IsRescatista, PAGINADO)
   *  - Devuelve RescateResponse[] dentro de { results }.
   *  - Cada uno trae el rescate_id (necesario para estado/cerrar) + la incidencia.
   *  - Si sale vacío NO es bug: es que esa cuenta no ha aceptado ningún caso.
   *
   * Esta es la fuente correcta para la pantalla accepted-cases (reemplaza el
   * truco temporal de filtrar listarReportes()).
   */
  listarMisRescates(): Observable<Paginated<RescateResponse>> {
    return this.http.get<Paginated<RescateResponse>>(`${this.rescatesUrl}mis-rescates/`);
  }

  /**
   * Detalle de un rescate + su historial/cronología.
   *
   * GET /api/rescates/{rescateId}/  (IsRescatista, dueño del rescate)
   *  - 403 si el rescate no es tuyo.
   *  - Úsalo para las pantallas cronology-case y progress-case.
   */
  obtenerRescate(rescateId: number): Observable<RescateResponse> {
    return this.http.get<RescateResponse>(`${this.rescatesUrl}${rescateId}/`);
  }

  /**
   * Acepta un caso como rescatista.
   *
   * POST /api/rescates/aceptar/{folio}/
   *  - Requiere rol RESCATISTA → si no, 403.
   *  - Usa el FOLIO (string), no el id.
   *  - Cambia la incidencia a ATENDIENDOSE y crea el Rescate (EN_CAMINO).
   *  - Devuelve un MensajeResponse, NO la incidencia.
   *
   * Errores a manejar en el componente:
   *  - 403 → no tiene rol RESCATISTA.
   *  - 404 → folio inexistente.
   *  - 400 → la incidencia ya no está PENDIENTE.
   *  - 409 → otro rescatista la tomó primero (condición de carrera).
   *
   * NOTA: no devuelve el rescate_id. Para obtenerlo, después de aceptar
   *       llama listarMisRescates() y busca por el folio.
   */
  aceptarCaso(folio: string): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(`${this.rescatesUrl}aceptar/${folio}/`, {});
  }

  /**
   * Actualiza el estado de un Rescate ya aceptado y registra una nota opcional
   * en el historial.
   *
   * PATCH /api/rescates/{rescateId}/estado/
   *  - Solo el rescatista dueño (si no, 403).
   *  - estado válido: 'EN_SITIO' | 'COMPLETADO' | 'CANCELADO'.
   *    (EN_CAMINO es el estado inicial al aceptar; RESCATADO se logra cerrando.)
   *  - nota es opcional y se guarda en el historial con timestamp.
   *
   * Flujo típico del voluntario:
   *   aceptar → (EN_CAMINO) → PATCH EN_SITIO → cerrar (COMPLETADO)
   */
  actualizarEstadoRescate(
    rescateId: number,
    estado: Extract<EstadoRescate, 'EN_SITIO' | 'COMPLETADO' | 'CANCELADO'>,
    nota?: string,
  ): Observable<MensajeResponse> {
    const body: { estado: string; nota?: string } = { estado };
    if (nota != null && nota.trim() !== '') body.nota = nota.trim();

    return this.http.patch<MensajeResponse>(`${this.rescatesUrl}${rescateId}/estado/`, body);
  }

  /**
 * Convierte coordenadas en una direccion completa (calle, colonia, CP, ciudad, estado, pais)
 * usando reverse-geocoding de Nominatim. Un solo lugar para toda la app.
 */
  obtenerDireccionCompleta(lat: number, lng: number): Promise<string> {
    return fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
      .then(r => r.json())
      .then(data => {
        const a = data?.address || {};
        const calle = a.road
          ? `${a.road}${a.house_number ? ' #' + a.house_number : ''}`
          : '';
        // Nominatim usa distintos nombres para "colonia" segun la zona
        const colonia = a.neighbourhood || a.suburb || a.hamlet || a.quarter || a.residential || '';
        const ciudad  = a.city || a.town || a.village || a.municipality || a.county || '';

        const partes = [
          calle,        // Avenida 93 Oriente
          colonia,      // Universidades
          a.postcode,   // 72587
          ciudad,       // Puebla
          a.state,      // Puebla
          a.country,    // Mexico
        ].filter(Boolean);

        return partes.length ? partes.join(', ') : (data?.display_name || 'Ubicación exacta');
      })
      .catch(() => 'Ubicación ajustada en el mapa');
  }

  /**
   * Cierra un Rescate con evidencia (foto + GPS).
   *
   * POST /api/rescates/{rescateId}/cerrar/
   *  - Solo el rescatista dueño (si no, 403).
   *  - foto y coordenadas actuales OBLIGATORIAS.
   *  - Exige estar a menos de 100 m del reporte → si no, 403 (gps_too_far).
   *  - Marca la incidencia como CERRADO y el rescate como COMPLETADO.
   */
  cerrarRescate(rescateId: number, lat: number, lng: number, foto: File, nota?: string): Observable<MensajeResponse> {
      const form = new FormData();
      form.append('lat', String(lat));
      form.append('lng', String(lng));
      form.append('foto', foto, foto.name);
      if (nota && nota.trim()) form.append('nota', nota.trim());

      return this.http.post<MensajeResponse>(`${this.rescatesUrl}${rescateId}/cerrar/`, form);
    }

  cancelarRescate(rescateId: number, motivo?: string): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(
      `${this.rescatesUrl}${rescateId}/cancelar/`,
      { motivo: motivo?.trim() || '' },
    );
  }
}