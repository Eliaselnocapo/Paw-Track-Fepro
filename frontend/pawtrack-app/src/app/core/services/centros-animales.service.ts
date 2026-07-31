import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  CentroAnimal,
  UbicacionUsuario
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

      tipo: 'refugio'
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
}
