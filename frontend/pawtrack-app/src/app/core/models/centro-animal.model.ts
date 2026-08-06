export interface UbicacionUsuario {
  latitud: number;
  longitud: number;
}

export type TipoCentro = 'refugio' | 'veterinaria' | 'otro';
export type EstadoSolicitudCentro = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface CentroAnimal {
  id: string;
  nombre: string;

  latitud: number;
  longitud: number;
  distanciaKm: number;

  direccion?: string;
  telefono?: string;
  sitioWeb?: string;
  horario?: string;

  tipo: TipoCentro;

  /**
   * true  = viene de tu backend, alguien lo registró y un admin lo aprobó.
   * false = viene de OpenStreetMap (Overpass), es un dato público de
   *         cualquier persona, nadie en PawTrack lo confirmó.
   */
  verificado: boolean;
}
export interface SolicitudCentroApoyo {
  id: number;
  nombre: string;
  tipo: TipoCentro;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono: string;
  horario?: string;
  sitioWeb?: string;
  descripcion?: string;
  estado: EstadoSolicitudCentro;
  motivoRechazo?: string;
  createdAt: string;
 
  bannerUrl?: string;
  logoUrl?: string;
  mision?: string;
  vision?: string;
  formasAyuda?: FormaAyuda[];
  redesSociales?: RedesSociales;
}
 
export interface NuevaSolicitudCentro {
  nombre: string;
  tipo: TipoCentro;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono: string;
  horario?: string;
  sitioWeb?: string;
  descripcion?: string;
 
  // Perfil (Fase 2) — todo opcional, se puede completar después
  banner?: File | null;
  logo?: File | null;
  mision?: string;
  vision?: string;
  formasAyuda?: FormaAyuda[];
  redesSociales?: RedesSociales;
}

export type FormaAyuda =
  | 'dinero'
  | 'comida'
  | 'viveres'
  | 'voluntariado'
  | 'adopciones';
 
export interface RedesSociales {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  whatsapp?: string;
}
 