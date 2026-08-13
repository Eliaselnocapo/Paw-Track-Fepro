export interface CartelReporte {
  folio: string;

  imagen?: string | File | null;

  nombreCaso?: string;
  tipoAnimal?: string;
  tamanoAnimal?: string;
  condicionAnimal?: string;

  direccion?: string;
  caracteristicas?: string;
  notasAnimal?: string;

  nombreContacto?: string;
  telefonoContacto?: string;

  tipoIncidencia?: string;
  fechaReporte?: string;

  incluirTalonPrivado?: boolean;
}