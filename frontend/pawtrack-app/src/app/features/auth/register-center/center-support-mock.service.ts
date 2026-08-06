import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { SolicitudCentroApoyo } from '../../../core/models/centro-animal.model';

// ─────────────────────────────────────────────────────────────────────────
// Tipos nuevos — Fase 3 (mini-blog), reseñas, seguidores. Viven aquí
// temporalmente mientras es puro mock; cuando el backend exista, mover a
// centro-animal.model.ts junto con los demás.
// ─────────────────────────────────────────────────────────────────────────

export interface PublicacionCentro {
  id: number;
  texto: string;
  fecha: string; // ISO
  imagenUrl?: string;
}

export interface ResenaCentro {
  id: number;
  autorNombre: string;
  autorFotoUrl?: string;
  calificacion: number; // 1-5
  comentario: string;
  fecha: string; // ISO
  respuestaCentro?: string; // respuesta pública del dueño del centro, si la hay
}

export interface SeguidorCentro {
  id: number;
  nombre: string;
  fotoUrl?: string;
  desde: string; // ISO
}

export interface EstadisticasCentro {
  seguidores: number;
  totalPublicaciones: number;
  calificacionPromedio: number; // 1-5
  totalResenas: number;
}

export interface PerfilCentroCompleto {
  centro: SolicitudCentroApoyo;
  estadisticas: EstadisticasCentro;
  publicaciones: PublicacionCentro[];
  resenas: ResenaCentro[];
  seguidoresLista: SeguidorCentro[];
}

/**
 * TODO backend: este servicio es temporal, igual que ReputacionMockService.
 * El perfil real va a necesitar varios endpoints, no solo uno:
 *
 *   GET /api/centros-apoyo/{id}/perfil/                 → datos básicos del centro
 *   GET /api/centros-apoyo/{id}/publicaciones/           → feed del mini-blog
 *   GET /api/centros-apoyo/{id}/resenas/                 → reseñas de usuarios
 *   GET /api/centros-apoyo/{id}/seguidores/              → lista de seguidores
 *   POST /api/centros-apoyo/{id}/seguir/                 → seguir/dejar de seguir
 *   PATCH /api/centros-apoyo/{id}/resenas/{rid}/responder/ → responder una reseña
 */
@Injectable({ providedIn: 'root' })
export class CentroApoyoMockService {

  obtenerPerfilMock(id: string): Observable<PerfilCentroCompleto> {
    const centro: SolicitudCentroApoyo = {
      id: 1,
      nombre: 'Veterinaria San Francisco',
      tipo: 'veterinaria',
      direccion: 'Calle Río Nexapa, Fraccionamiento la aldea, Puebla, Municipio de Puebla, Puebla, 72570, Mexico',
      latitud: 19.0042,
      longitud: -98.2012,
      telefono: '2222222222',
      horario: 'Lun-Vie 9:00-18:00',
      sitioWeb: 'https://veterinariasanfrancisco.com',
      descripcion: 'Somos una clínica veterinaria con más de 10 años de experiencia atendiendo animales de la zona.',
      estado: 'APROBADO',
      createdAt: '2026-07-20T10:00:00',

      bannerUrl: undefined,
      logoUrl: undefined,
      mision: 'Brindar atención veterinaria de calidad y accesible a todas las familias con mascotas de nuestra comunidad.',
      vision: 'Ser el centro de referencia en salud animal de la región, promoviendo la tenencia responsable.',
      formasAyuda: ['dinero', 'comida', 'viveres', 'voluntariado'],
      redesSociales: {
        facebook: 'https://facebook.com/vetsanfrancisco',
        instagram: 'https://instagram.com/vetsanfrancisco',
        whatsapp: '2222222222',
      },
    };

    const estadisticas: EstadisticasCentro = {
      seguidores: 128,
      totalPublicaciones: 3,
      calificacionPromedio: 4.6,
      totalResenas: 24,
    };

    const publicaciones: PublicacionCentro[] = [
      {
        id: 1,
        texto: '¡Jornada de esterilización gratuita este sábado! Cupo limitado, agenda tu cita por WhatsApp.',
        fecha: '2026-08-03T09:00:00',
        imagenUrl: 'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=800&auto=format&fit=crop',
      },
      {
        id: 2,
        texto: 'Encontramos 3 cachorros mestizos en buen estado de salud, listos para adopción. Contáctanos si te interesa darles un hogar.',
        fecha: '2026-07-28T15:30:00',
        imagenUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop',
      },
      {
        id: 3,
        texto: 'Recordatorio: la vacuna antirrábica es gratuita todo agosto. Trae a tu mascota entre semana de 9am a 2pm.',
        fecha: '2026-07-20T11:00:00',
      },
    ];

    const resenas: ResenaCentro[] = [
      {
        id: 1,
        autorNombre: 'María González',
        calificacion: 5,
        comentario: 'Excelente atención, muy profesionales y accesibles. Salvaron a mi gato de una intoxicación.',
        fecha: '2026-07-15T12:00:00',
      },
      {
        id: 2,
        autorNombre: 'Jorge Ramírez',
        calificacion: 4,
        comentario: 'Buen servicio, aunque a veces hay que esperar un poco. Los precios son justos.',
        fecha: '2026-07-10T09:00:00',
        respuestaCentro: 'Gracias por tu comentario, Jorge. Estamos trabajando en reducir los tiempos de espera.',
      },
      {
        id: 3,
        autorNombre: 'Ana Torres',
        calificacion: 5,
        comentario: 'Adopté a uno de sus cachorros rescatados, todo el proceso fue muy transparente y cuidadoso.',
        fecha: '2026-06-28T18:00:00',
      },
      {
        id: 5,
        autorNombre: 'Ana Torres',
        calificacion: 5,
        comentario: 'Adopté a uno de sus cachorros rescatados, todo el proceso fue muy transparente y cuidadoso.',
        fecha: '2026-06-28T18:00:00',
      },
    ];

    const seguidoresLista: SeguidorCentro[] = [
      { id: 1, nombre: 'Laura Méndez', desde: '2026-07-01T00:00:00' },
      { id: 2, nombre: 'Carlos Ibarra', desde: '2026-07-05T00:00:00' },
      { id: 3, nombre: 'Fernanda Ruiz', desde: '2026-07-10T00:00:00' },
      { id: 4, nombre: 'Diego Ponce', desde: '2026-07-18T00:00:00' },
      { id: 5, nombre: 'Valeria Nava', desde: '2026-07-22T00:00:00' },
    ];

    return of({ centro, estadisticas, publicaciones, resenas, seguidoresLista }).pipe(delay(300));
  }

  /**
   * TODO backend: POST /api/centros-apoyo/{id}/resenas/
   */
  crearResenaMock(
    id: string,
    calificacion: number,
    comentario: string
  ): Observable<ResenaCentro> {
    const nueva: ResenaCentro = {
      id: Date.now(),
      autorNombre: 'Tú', // TODO backend: vendría de request.user.nombre
      calificacion,
      comentario,
      fecha: new Date().toISOString(),
    };

    return of(nueva).pipe(delay(300));
  }

  /**
   * TODO backend: POST /api/centros-apoyo/{id}/publicaciones/ (multipart,
   * por la imagen). Requiere en el back que request.user sea el dueño
   * del centro (403 si no).
   */
  crearPublicacionMock(
    id: string,
    texto: string,
    imagenUrl?: string
  ): Observable<PublicacionCentro> {
    const nueva: PublicacionCentro = {
      id: Date.now(),
      texto,
      imagenUrl,
      fecha: new Date().toISOString(),
    };

    return of(nueva).pipe(delay(300));
  }

  /**
   * TODO backend: PATCH /api/centros-apoyo/{centroId}/publicaciones/{id}/
   */
  editarPublicacionMock(
    postId: number,
    texto: string,
    imagenUrl?: string
  ): Observable<{ id: number; texto: string; imagenUrl?: string }> {
    return of({ id: postId, texto, imagenUrl }).pipe(delay(300));
  }

  /**
   * TODO backend: PATCH /api/centros-apoyo/{centroId}/resenas/{resenaId}/responder/
   * Solo el dueño del centro puede responder — el back debe validarlo.
   */
  responderResenaMock(
    resenaId: number,
    respuesta: string
  ): Observable<{ resenaId: number; respuesta: string }> {
    return of({ resenaId, respuesta }).pipe(delay(300));
  }
}