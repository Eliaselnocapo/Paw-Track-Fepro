export interface UbicacionUsuario {
  latitud: number;
  longitud: number;
}

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

  tipo: 'refugio';
}
