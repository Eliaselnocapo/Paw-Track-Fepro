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
      .get<any[]>(`${environment.apiUrl}/centros-apoyo/cercanos/`, { params })
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
      osm: this.buscarRefugios(ubicacion, radioKm),
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
      .post<any>(`${environment.apiUrl}/centros-apoyo/`, formData)
      .pipe(map((r) => this.mapearSolicitud(r)));
  }
 
  /** Las solicitudes que ha hecho el usuario logueado (para ver su estado). */
  misSolicitudesCentro(): Observable<SolicitudCentroApoyo[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/centros-apoyo/mis-solicitudes/`)
      .pipe(map((lista) => lista.map((r) => this.mapearSolicitud(r))));
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
