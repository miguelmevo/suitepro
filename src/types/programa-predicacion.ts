export interface PuntoEncuentro {
  id: string;
  nombre: string;
  direccion: string | null;
  url_maps: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Territorio {
  id: string;
  numero: string;
  nombre: string | null;
  descripcion: string | null;
  url_maps: string | null;
  imagen_url: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManzanaTerritorio {
  id: string;
  territorio_id: string;
  letra: string;
  activo: boolean;
  created_at: string;
}

export interface HorarioSalida {
  id: string;
  hora: string;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
}

export interface AsignacionGrupo {
  grupo_id: string;
  territorio_id: string;
}

export interface ProgramaPredicacion {
  id: string;
  fecha: string;
  horario_id: string | null;
  punto_encuentro_id: string | null;
  territorio_id: string | null;
  territorio_ids: string[];
  capitan_id: string | null;
  es_mensaje_especial: boolean;
  mensaje_especial: string | null;
  colspan_completo: boolean;
  es_por_grupos: boolean;
  asignaciones_grupos: AsignacionGrupo[];
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramaConDetalles extends ProgramaPredicacion {
  horario?: HorarioSalida | null;
  punto_encuentro?: PuntoEncuentro | null;
  territorio?: Territorio | null;
  territorios?: Territorio[];
  capitan?: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
}

export type PeriodoPrograma = 'semanal' | 'quincenal' | 'mensual';

export interface DiaPrograma {
  fecha: string;
  diaSemana: string;
  entradas: ProgramaConDetalles[];
  esMensajeEspecial: boolean;
  mensajeEspecial?: string;
}
