import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';

import {
  CentroAnimal,
  UbicacionUsuario,
  SolicitudCentroApoyo,
  NuevaSolicitudCentro
} from '../models/centro-animal.model';

interface OverpassTags {
  name?: string;
  operator?: string;

  phone?: string;
  'contact:phone'?: string;

  website?: string;
  'contact:website'?: string;

  opening_hours?: string;

  'addr:street'?: string;
  'addr:housenumber'?: string;
  'addr:suburb'?: string;
  'addr:city'?: string;
  'addr:state'?: string;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;

  lat?: number;
  lon?: number;

  center?: {
    lat: number;
    lon: number;
  };

  tags?: OverpassTags;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export interface UsuarioResumen {
  id: number;
  firstName: string;
  lastName: string;
  fotoPerfil: string | null;
}

export interface PublicacionCentro {
  id: number;
  contenido: string;
  imagenUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResenaCentro {
  id: number;
  usuario: UsuarioResumen;
  calificacion: number;
  comentario: string;
  respuesta: string | null;
  respuestaFecha: string | null;
  createdAt: string;
}

export interface SeguidorCentro {
  id: number;
  usuario: UsuarioResumen;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class CentrosAnimalesService {
  private readonly http = inject(HttpClient);

  private readonly overpassUrl =
    'https://overpass-api.de/api/interpreter';

  obtenerUbicacionUsuario(): Promise<UbicacionUsuario> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            'Este dispositivo no permite obtener la ubicación.'
          )
        );

        return;
      }

      navigator.geolocation.getCurrentPosition(
        posicion => {
          resolve({
            latitud: posicion.coords.latitude,
            longitud: posicion.coords.longitude
          });
        },
        error => {
          reject(
            new Error(
              this.obtenerMensajeErrorUbicacion(error)
            )
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 60_000
        }
      );
    });
  }

  buscarRefugios(
    ubicacion: UbicacionUsuario,
    radioKm: number
  ): Observable<CentroAnimal[]> {
    const radioMetros = Math.round(radioKm * 1000);

    const consulta = `
      [out:json][timeout:25];

      (
        node["amenity"="animal_shelter"]
          (around:${radioMetros},${ubicacion.latitud},${ubicacion.longitud});

        way["amenity"="animal_shelter"]
          (around:${radioMetros},${ubicacion.latitud},${ubicacion.longitud});

        relation["amenity"="animal_shelter"]
          (around:${radioMetros},${ubicacion.latitud},${ubicacion.longitud});
      );

      out center tags;
    `;

    const parametros = new HttpParams().set(
      'data',
      consulta
    );

    return this.http
      .get<OverpassResponse>(
        this.overpassUrl,
        { params: parametros }
      )
      .pipe(
        map(respuesta =>
          respuesta.elements
            .map(elemento =>
              this.convertirCentro(
                elemento,
                ubicacion
              )
            )
            .filter(
              (centro): centro is CentroAnimal =>
                centro !== null
            )
            .sort(
              (a, b) =>
                a.distanciaKm - b.distanciaKm
            )
        )
      );
  }

  private convertirCentro(
    elemento: OverpassElement,
    ubicacion: UbicacionUsuario
  ): CentroAnimal | null {
    const latitud =
      elemento.lat ?? elemento.center?.lat;

    const longitud =
      elemento.lon ?? elemento.center?.lon;

    if (
      latitud === undefined ||
      longitud === undefined
    ) {
      return null;
    }

    const tags = elemento.tags ?? {};

    return {
      id: `${elemento.type}-${elemento.id}`,

      nombre:
        tags.name ??
        tags.operator ??
        'Refugio de animales',

      latitud,
      longitud,

      distanciaKm:
        this.calcularDistanciaKm(
          ubicacion.latitud,
          ubicacion.longitud,
          latitud,
          longitud
        ),

      direccion:
        this.construirDireccion(tags),

      telefono:
        tags['contact:phone'] ??
        tags.phone,

      sitioWeb:
        tags['contact:website'] ??
        tags.website,

      horario:
        tags.opening_hours,

      tipo: 'refugio',
      verificado: false
    };
  }

  private construirDireccion(
    tags: OverpassTags
  ): string | undefined {
    const calle = [
      tags['addr:street'],
      tags['addr:housenumber']
    ]
      .filter(Boolean)
      .join(' ');

    const partes = [
      calle,
      tags['addr:suburb'],
      tags['addr:city'],
      tags['addr:state']
    ].filter(Boolean);

    return partes.length > 0
      ? partes.join(', ')
      : undefined;
  }

  private calcularDistanciaKm(
    latitudOrigen: number,
    longitudOrigen: number,
    latitudDestino: number,
    longitudDestino: number
  ): number {
    const radioTierraKm = 6371;

    const convertirARadianes = (
      grados: number
    ): number => grados * Math.PI / 180;

    const diferenciaLatitud =
      convertirARadianes(
        latitudDestino - latitudOrigen
      );

    const diferenciaLongitud =
      convertirARadianes(
        longitudDestino - longitudOrigen
      );

    const origenRadianes =
      convertirARadianes(latitudOrigen);

    const destinoRadianes =
      convertirARadianes(latitudDestino);

    const calculo =
      Math.sin(diferenciaLatitud / 2) ** 2 +
      Math.cos(origenRadianes) *
      Math.cos(destinoRadianes) *
      Math.sin(diferenciaLongitud / 2) ** 2;

    const distancia =
      2 *
      radioTierraKm *
      Math.asin(Math.sqrt(calculo));

    return Number(distancia.toFixed(1));
  }

  private obtenerMensajeErrorUbicacion(
    error: GeolocationPositionError
  ): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Debes permitir el acceso a tu ubicación.';

      case error.POSITION_UNAVAILABLE:
        return 'No fue posible obtener tu ubicación.';

      case error.TIMEOUT:
        return 'La ubicación tardó demasiado en responder.';

      default:
        return 'Ocurrió un error al obtener tu ubicación.';
    }
  }

  buscarCentrosVerificados(
    ubicacion: UbicacionUsuario,
    radioKm: number
  ): Observable<CentroAnimal[]> {
    const params = new HttpParams()
      .set('lat', ubicacion.latitud)
      .set('lng', ubicacion.longitud)
      .set('radio_km', radioKm);
 
    return this.http
      .get<any[]>(`${environment.apiUrl}/centros/cercanos/`, { params })
      .pipe(
        map((resultados) =>
          resultados.map((c) => ({
            id: `verificado-${c.id}`,
            nombre: c.nombre,
            latitud: c.latitud,
            longitud: c.longitud,
            distanciaKm: this.calcularDistanciaKm(
              ubicacion.latitud,
              ubicacion.longitud,
              c.latitud,
              c.longitud
            ),
            direccion: c.direccion ?? undefined,
            telefono: c.telefono ?? undefined,
            sitioWeb: c.sitio_web ?? undefined,
            horario: c.horario ?? undefined,
            tipo: c.tipo ?? 'otro',
            verificado: true, // <-- viene de tu backend, ya fue aprobado
          }))
        )
      );
  }
  
  buscarTodosLosCentros(
    ubicacion: UbicacionUsuario,
    radioKm: number
  ): Observable<CentroAnimal[]> {
    return forkJoin({
      osm: this.buscarRefugios(ubicacion, radioKm).pipe(
        catchError(() => of([] as CentroAnimal[]))
      ),
      verificados: this.buscarCentrosVerificados(ubicacion, radioKm).pipe(
        catchError(() => of([] as CentroAnimal[]))
      ),
    }).pipe(
      map(({ osm, verificados }) =>
        [...verificados, ...osm].sort((a, b) => a.distanciaKm - b.distanciaKm)
      )
    );
  }

    /** Registra una solicitud nueva de centro de apoyo (queda en PENDIENTE). */
  registrarCentro(
    solicitud: NuevaSolicitudCentro
  ): Observable<SolicitudCentroApoyo> {
    const formData = new FormData();
 
    formData.append('nombre', solicitud.nombre);
    formData.append('tipo', solicitud.tipo);
    formData.append('direccion', solicitud.direccion);
    formData.append('latitud', String(solicitud.latitud));
    formData.append('longitud', String(solicitud.longitud));
    formData.append('telefono', solicitud.telefono);
 
    if (solicitud.horario) formData.append('horario', solicitud.horario);
    if (solicitud.sitioWeb) formData.append('sitio_web', solicitud.sitioWeb);
    if (solicitud.descripcion) formData.append('descripcion', solicitud.descripcion);
    if (solicitud.mision) formData.append('mision', solicitud.mision);
    if (solicitud.vision) formData.append('vision', solicitud.vision);
 
    if (solicitud.banner) formData.append('banner', solicitud.banner);
    if (solicitud.logo) formData.append('logo', solicitud.logo);
 
    // Arrays/objetos van como JSON string dentro del FormData — es el
    // patrón estándar, el backend los parsea con json.loads() del lado
    // de Django al recibir el campo.
    if (solicitud.formasAyuda?.length) {
      formData.append('formas_ayuda', JSON.stringify(solicitud.formasAyuda));
    }
    if (solicitud.redesSociales) {
      formData.append('redes_sociales', JSON.stringify(solicitud.redesSociales));
    }
 
    return this.http
      .post<any>(`${environment.apiUrl}/centros/`, formData)
      .pipe(map((r) => this.mapearSolicitud(r)));
  }
 
  /** Las solicitudes que ha hecho el usuario logueado (para ver su estado). */
  misSolicitudesCentro(): Observable<SolicitudCentroApoyo[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/centros/mis-solicitudes/`)
      .pipe(map((lista) => lista.map((r) => this.mapearSolicitud(r))));
  }

  // ── Edición del centro ─────────────────────────────────────────────

  editarCentro(id: number, cambios: Partial<NuevaSolicitudCentro>): Observable<SolicitudCentroApoyo> {
    const formData = new FormData();

    if (cambios.nombre !== undefined) formData.append('nombre', cambios.nombre);
    if (cambios.tipo !== undefined) formData.append('tipo', cambios.tipo);
    if (cambios.telefono !== undefined) formData.append('telefono', cambios.telefono);
    if (cambios.horario !== undefined) formData.append('horario', cambios.horario);
    if (cambios.sitioWeb !== undefined) formData.append('sitio_web', cambios.sitioWeb);
    if (cambios.descripcion !== undefined) formData.append('descripcion', cambios.descripcion);
    if (cambios.mision !== undefined) formData.append('mision', cambios.mision);
    if (cambios.vision !== undefined) formData.append('vision', cambios.vision);
    if (cambios.banner) formData.append('banner', cambios.banner);
    if (cambios.logo) formData.append('logo', cambios.logo);
    if (cambios.formasAyuda) formData.append('formas_ayuda', JSON.stringify(cambios.formasAyuda));
    if (cambios.redesSociales) formData.append('redes_sociales', JSON.stringify(cambios.redesSociales));

    return this.http
      .patch<any>(`${environment.apiUrl}/centros/${id}/`, formData)
      .pipe(map((r) => this.mapearSolicitud(r)));
  }

  // ── Publicaciones ───────────────────────────────────────────────────

  listarPublicaciones(centroId: number): Observable<PublicacionCentro[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/centros/${centroId}/publicaciones/`)
      .pipe(map((lista) => lista.map((p) => this.mapearPublicacion(p))));
  }

  crearPublicacion(centroId: number, contenido: string, imagen?: File): Observable<PublicacionCentro> {
    const formData = new FormData();
    formData.append('contenido', contenido);
    if (imagen) formData.append('imagen', imagen);

    return this.http
      .post<any>(`${environment.apiUrl}/centros/${centroId}/publicaciones/`, formData)
      .pipe(map((p) => this.mapearPublicacion(p)));
  }

  editarPublicacion(centroId: number, postId: number, contenido: string, imagen?: File): Observable<PublicacionCentro> {
    const formData = new FormData();
    formData.append('contenido', contenido);
    if (imagen) formData.append('imagen', imagen);

    return this.http
      .patch<any>(`${environment.apiUrl}/centros/${centroId}/publicaciones/${postId}/`, formData)
      .pipe(map((p) => this.mapearPublicacion(p)));
  }

  eliminarPublicacion(centroId: number, postId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/centros/${centroId}/publicaciones/${postId}/`);
  }

  // ── Reseñas ─────────────────────────────────────────────────────────

  listarResenas(centroId: number): Observable<ResenaCentro[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/centros/${centroId}/resenas/`)
      .pipe(map((lista) => lista.map((r) => this.mapearResena(r))));
  }

  crearResena(centroId: number, calificacion: number, comentario: string): Observable<ResenaCentro> {
    return this.http
      .post<any>(`${environment.apiUrl}/centros/${centroId}/resenas/`, { calificacion, comentario })
      .pipe(map((r) => this.mapearResena(r)));
  }

  responderResena(centroId: number, resenaId: number, respuesta: string): Observable<ResenaCentro> {
    return this.http
      .patch<any>(`${environment.apiUrl}/centros/${centroId}/resenas/${resenaId}/responder/`, { respuesta })
      .pipe(map((r) => this.mapearResena(r)));
  }

  // ── Seguidores ──────────────────────────────────────────────────────

  listarSeguidores(centroId: number): Observable<SeguidorCentro[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/centros/${centroId}/seguidores/`)
      .pipe(map((lista) => lista.map((s) => this.mapearSeguidor(s))));
  }

  toggleSeguir(centroId: number): Observable<{ siguiendo: boolean }> {
    return this.http.post<{ siguiendo: boolean }>(`${environment.apiUrl}/centros/${centroId}/seguir/`, {});
  }

  // ── Mapeos privados ─────────────────────────────────────────────────

  private mapearPublicacion(p: any): PublicacionCentro {
    return {
      id: p.id,
      contenido: p.contenido,
      imagenUrl: p.imagen ?? null,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }

  private mapearUsuarioResumen(u: any): UsuarioResumen {
    return {
      id: u.id,
      firstName: u.first_name ?? '',
      lastName: u.last_name ?? '',
      fotoPerfil: u.foto_perfil ?? null,
    };
  }

  private mapearResena(r: any): ResenaCentro {
    return {
      id: r.id,
      usuario: this.mapearUsuarioResumen(r.usuario),
      calificacion: r.calificacion,
      comentario: r.comentario,
      respuesta: r.respuesta ?? null,
      respuestaFecha: r.respuesta_fecha ?? null,
      createdAt: r.created_at,
    };
  }

  private mapearSeguidor(s: any): SeguidorCentro {
    return {
      id: s.id,
      usuario: this.mapearUsuarioResumen(s.usuario),
      createdAt: s.created_at,
    };
  }
    

    /** Perfil básico de un centro específico (vista pública /centro/:id). */
  obtenerPerfilBasico(id: number): Observable<SolicitudCentroApoyo> {
    return this.http
      .get<any>(`${environment.apiUrl}/centros/${id}/perfil/`)
      .pipe(map((r) => this.mapearSolicitud(r)));
  }
 
  private mapearSolicitud(r: any): SolicitudCentroApoyo {
    return {
      id: r.id,
      nombre: r.nombre,
      tipo: r.tipo,
      direccion: r.direccion,
      latitud: r.latitud,
      longitud: r.longitud,
      telefono: r.telefono,
      horario: r.horario ?? undefined,
      sitioWeb: r.sitio_web ?? undefined,
      descripcion: r.descripcion ?? undefined,
      estado: r.estado,
      motivoRechazo: r.motivo_rechazo ?? undefined,
      createdAt: r.created_at,
 
      bannerUrl: r.banner ?? undefined,
      logoUrl: r.logo ?? undefined,
      mision: r.mision ?? undefined,
      vision: r.vision ?? undefined,
      formasAyuda: r.formas_ayuda ?? undefined,
      redesSociales: r.redes_sociales ?? undefined,
    };
  }
 
}
