import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface DenunciaFraude {
  id: number;
  usuario_reporta: number;
  usuario_reporta_email: string;
  motivo: string;
  created_at: string;
}

export interface DenunciaCola {
  id: number;
  folio: string;
  estado: string;
  tipo_animal: string;
  usuario_reporta_email: string;
  reportes_fraude_count: number;
  oculto_por_fraude: boolean;
  created_at: string;
  reportes: DenunciaFraude[];
}

export interface CentroPendiente {
  id: number;
  nombre: string;
  tipo: string;
  correo: string;
  telefono: string;
  direccion: string;
  usuario_email: string;
  estado: string;
  created_at: string;
}

export interface ColaModeracion {
  denuncias: DenunciaCola[];
  centros_pendientes: CentroPendiente[];
}

@Injectable({ providedIn: 'root' })
export class ModeracionService {
  private base = `${environment.apiUrl}/moderacion/`;

  constructor(private http: HttpClient) {}

  reportarFraude(folio: string, motivo: string = ''): Observable<any> {
    return this.http.post(`${this.base}incidencias/${folio}/reportar-fraude/`, { motivo });
  }

  obtenerCola(): Observable<ColaModeracion> {
    return this.http.get<ColaModeracion>(`${this.base}cola/`);
  }

  resolverDenuncia(folio: string, accion: 'descartar' | 'confirmar_fraude'): Observable<any> {
    return this.http.post(`${this.base}denuncias/${folio}/resolver/`, { accion });
  }

  resolverCentro(centroId: number, accion: 'aprobar' | 'rechazar', motivoRechazo: string = ''): Observable<any> {
    return this.http.post(`${this.base}centros/${centroId}/resolver/`, {
      accion,
      motivo_rechazo: motivoRechazo,
    });
  }
}