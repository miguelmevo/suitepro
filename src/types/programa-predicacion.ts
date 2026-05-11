export interface PuntoEncuentro {
  id: string;
  nombre: string;
  direccion: string | null;
  url_maps: string | null;
  numero_salida: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Territorio {
  id: string;
  numero: string;
  nombre: string | null;
  url_maps: string | null;
  imagen_url: string | null;
  grupo_predicacion_id: string | null;
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

export type FranjaHoraria = "manana" | "tarde";

export interface HorarioSalida {
  id: string;
  hora: string;
  nombre: string;
  orden: number;
  franja: FranjaHoraria;
  activo: boolean;
  created_at: string;
}

/** Devuelve la franja del horario: respeta el campo `franja` si existe, sino la deduce por la hora (<12 = mañana, >=12 = tarde). */
export function getFranjaHorario(horario: { franja?: string | null; hora: string; nombre?: string }): FranjaHoraria {
  if (horario.franja === "manana" || horario.franja === "tarde") return horario.franja;
  // Fallback heredado: por nombre
  const nombreLower = (horario.nombre || "").toLowerCase();
  if (nombreLower.includes("mañana") || nombreLower.includes("manana")) return "manana";
  if (nombreLower.includes("tarde")) return "tarde";
  // Fallback final: por hora
  const hora = parseInt((horario.hora || "00").split(":")[0], 10);
  return hora < 12 ? "manana" : "tarde";
}

export interface AsignacionGrupo {
  grupo_id: string;
  territorio_id: string;
  territorio_ids?: string[];
  salida_index?: number;
  capitan_id?: string;
  punto_encuentro_id?: string;
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
