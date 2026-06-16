import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UsuarioResponse {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  rol_principal: string;
  telefono: string;
  foto_perfil: string | null;
  perfil_rescatista?: any;
  perfil_patrocinador?: any;
}

export interface IncidenciaResponse {
  id: number;
  usuario_reporta: number | null;
  animal: number | null;
  caracteristicas: string;
  imagen: string | null;
  lat_out: number | null;
  lng_out: number | null;
  estado: string;
  tipo_incidencia: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly usuariosUrl = `${environment.apiUrl}/api/usuarios/`;
  private readonly incidenciasUrl = `${environment.apiUrl}/api/incidencias/`;

  constructor(private http: HttpClient) {}

  obtenerUsuario(id: number): Observable<UsuarioResponse> {
    return this.http.get<UsuarioResponse>(`${this.usuariosUrl}${id}/`);
  }

  listarIncidencias(): Observable<IncidenciaResponse[]> {
    return this.http.get<IncidenciaResponse[]>(this.incidenciasUrl);
  }

  obtenerReportesDelUsuario(usuarioId: number): Observable<IncidenciaResponse[]> {
    return this.listarIncidencias().pipe(
      map((reportes) =>
        reportes.filter((reporte) => reporte.usuario_reporta === usuarioId)
      )
    );
  }
}
