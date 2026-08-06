import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface LogroTimeline {
  tipo: 'reporte' | 'aceptado' | 'cerrado' | 'seguimiento' | 'nivel';
  titulo: string;
  fecha: string; // ISO
}

export type EstadoValidacion = 'validado' | 'falso_positivo' | 'pendiente';

export interface HistorialCaso {
  folio: string;
  tipo: string;
  estado: EstadoValidacion;
  fraudFlags: number;
  urgencyMultiplier: number;
  impactoPuntos: number;
}

export interface ReputacionResponse {
  reportesTotales: number;
  reportesValidos: number;
  rescatesAceptados: number;
  rescatesCompletados: number;
  seguimientos: number;
  score: number;
  impactoFraude: number; // puntos negativos totales por fraude, ej. -15
  timeline: LogroTimeline[];
  historialCasos: HistorialCaso[];
}

/**
 * TODO backend: este servicio es temporal.
 * Cuando exista GET /api/usuarios/{id}/reputacion/, reemplazar
 * por un servicio real que use HttpClient contra ese endpoint,
 * manteniendo la misma interfaz ReputacionResponse.
 */
@Injectable({ providedIn: 'root' })
export class ReputacionMockService {

  obtenerReputacionMock(): Observable<ReputacionResponse> {
    const mock: ReputacionResponse = {
      reportesTotales: 19,
      reportesValidos: 17,
      rescatesAceptados: 8,
      rescatesCompletados: 1,
      seguimientos: 1,
      score: 64,
      impactoFraude: -15,

      timeline: [
        { tipo: 'nivel', titulo: 'Alcanzaste el nivel "Rescatista confiable"', fecha: '2026-07-28T10:00:00' },
        { tipo: 'cerrado', titulo: 'Completaste tu primer rescate', fecha: '2026-07-25T18:30:00' },
        { tipo: 'aceptado', titulo: 'Aceptaste un caso de gato herido', fecha: '2026-07-22T09:15:00' },
        { tipo: 'seguimiento', titulo: 'Actualizaste la bitácora de un caso', fecha: '2026-07-20T16:45:00' },
        { tipo: 'reporte', titulo: 'Reportaste un perro extraviado', fecha: '2026-07-18T12:00:00' },
      ],

      historialCasos: [
        { folio: 'REP-104', tipo: 'Avistamiento', estado: 'validado', fraudFlags: 0, urgencyMultiplier: 1.2, impactoPuntos: 2.5 },
        { folio: 'REP-098', tipo: 'Rescate completado', estado: 'validado', fraudFlags: 0, urgencyMultiplier: 1.0, impactoPuntos: 5 },
        { folio: 'REP-092', tipo: 'Emergencia', estado: 'falso_positivo', fraudFlags: 3, urgencyMultiplier: 0.0, impactoPuntos: -15 },
        { folio: 'REP-088', tipo: 'Refugio', estado: 'pendiente', fraudFlags: 0, urgencyMultiplier: 1.0, impactoPuntos: 0 },
        { folio: 'REP-081', tipo: 'Rescate aceptado', estado: 'validado', fraudFlags: 0, urgencyMultiplier: 1.0, impactoPuntos: 3 },
      ],
    };

    return of(mock).pipe(delay(400));
  }
}