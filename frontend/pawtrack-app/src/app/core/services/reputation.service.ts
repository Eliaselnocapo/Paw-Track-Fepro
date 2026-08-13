import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  impactoFraude: number;
  timeline: LogroTimeline[];
  historialCasos: HistorialCaso[];
}

@Injectable({ providedIn: 'root' })
export class ReputacionService {
  constructor(private http: HttpClient) {}

  obtenerReputacion(userId: number): Observable<ReputacionResponse> {
    return this.http.get<ReputacionResponse>(`${environment.apiUrl}/usuarios/${userId}/reputacion/`);
  }
}