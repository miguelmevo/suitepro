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
  /** IDs de todos los grupos de predicación asignados (N-a-N). Vacío/undefined = disponible para todos los grupos. */
  grupos_predicacion_ids?: string[];
  /** Si es false, el territorio se excluye de las estadísticas de predicación. Default true. */
  incluir_en_estadisticas?: boolean;
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
  /** ID del grupo ficticio (mutuamente excluyente con grupo_id real) */
  grupo_ficticio_id?: string;
  /** Nombre del grupo ficticio (snapshot para render) */
  grupo_ficticio_nombre?: string;
  /** Si está true, el grupo se conserva pero NO se muestra en UI ni impresión */
  disabled?: boolean;
}

/** Cómo se predica en la salida. Es ortogonal a cómo se organiza (general / por grupos / individual). */
export type ModalidadSalida = "territorio" | "cartas_presencial" | "telefono";

export const MODALIDADES_SALIDA: { value: ModalidadSalida; label: string }[] = [
  { value: "territorio", label: "Territorio (casa por casa)" },
  { value: "cartas_presencial", label: "Cartas presencial" },
  { value: "telefono", label: "Teléfono" },
];

export function etiquetaModalidad(modalidad?: ModalidadSalida | null): string {
  return MODALIDADES_SALIDA.find((m) => m.value === modalidad)?.label ?? "Territorio (casa por casa)";
}

/**
 * Qué mostrar en la columna "Punto de encuentro" cuando la entrada no tiene un
 * punto asignado. Para `territorio` devuelve "" a propósito, para conservar el
 * fallback histórico a "ZOOM" de la vista de impresión.
 */
export function etiquetaPuntoPorModalidad(modalidad?: ModalidadSalida | null): string {
  switch (modalidad) {
    case "telefono":
      return "TELÉFONO";
    case "cartas_presencial":
      return "CARTAS";
    default:
      return "";
  }
}

/**
 * Qué campos aplican según la modalidad y cómo está organizada la salida.
 * - territorio: casa por casa, lleva territorio y punto de encuentro.
 * - cartas_presencial: sin territorio; lleva punto salvo en grupo individual,
 *   donde cada grupo se pone de acuerdo dónde juntarse.
 * - telefono: sin territorio ni punto (se llama desde donde cada uno esté).
 */
export function camposSegunModalidad(
  modalidad: ModalidadSalida | null | undefined,
  esPorGrupoIndividual: boolean,
): { usaTerritorio: boolean; usaPuntoEncuentro: boolean } {
  switch (modalidad) {
    case "cartas_presencial":
      return { usaTerritorio: false, usaPuntoEncuentro: !esPorGrupoIndividual };
    case "telefono":
      return { usaTerritorio: false, usaPuntoEncuentro: false };
    default:
      return { usaTerritorio: true, usaPuntoEncuentro: true };
  }
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
  modalidad: ModalidadSalida;
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
