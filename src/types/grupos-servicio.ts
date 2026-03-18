export interface Participante {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  estado_aprobado: boolean;
  responsabilidad: string[];
  responsabilidad_adicional: string | null;
  grupo_predicacion_id: string | null;
  restriccion_disponibilidad: string | null;
  es_capitan_grupo: boolean;
  es_publicador_inactivo: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface GrupoServicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MiembroGrupo {
  id: string;
  participante_id: string;
  grupo_id: string;
  es_capitan: boolean;
  activo: boolean;
  created_at: string;
  participante?: Participante;
}

export interface GrupoConMiembros extends GrupoServicio {
  miembros: MiembroGrupo[];
}