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

/** Cómo se organiza la salida. Se guarda explícito en `tipo_salida`. */
export type TipoSalida = "sin_asignar" | "dia_especial" | "por_grupos" | "por_grupo_individual";

/** Cómo se predica en la salida. Es ortogonal a cómo se organiza (general / por grupos / individual). */
export type ModalidadSalida = "territorio" | "cartas_presencial" | "telefono";

export const MODALIDADES_SALIDA: { value: ModalidadSalida; label: string }[] = [
  { value: "territorio", label: "Territorio (de casa en casa)" },
  { value: "cartas_presencial", label: "Cartas presencial" },
  { value: "telefono", label: "Teléfono" },
];

export function etiquetaModalidad(modalidad?: ModalidadSalida | null): string {
  return MODALIDADES_SALIDA.find((m) => m.value === modalidad)?.label ?? "Territorio (de casa en casa)";
}

/**
 * En una salida por grupo individual sin detalle por grupo (cartas/teléfono) no
 * hay un capitán único: cada grupo sale con su propio superintendente.
 */
export const CAPITAN_POR_GRUPO = "Superintendente de cada grupo";

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
 * - cartas_presencial: lleva territorio; el punto solo cuando NO es por grupo
 *   individual (ahí cada grupo se pone de acuerdo dónde juntarse). En
 *   individual tampoco se detalla nada grupo por grupo: el territorio de
 *   cartas se define una vez para toda la salida.
 * - telefono: sin territorio ni punto (se llama desde donde cada uno esté).
 *
 * `detallePorGrupo` indica si el formulario debe pedir datos grupo por grupo;
 * cuando es false no hay nada que llenar por grupo y la salida se guarda como
 * una sola fila.
 */
export function camposSegunModalidad(
  modalidad: ModalidadSalida | null | undefined,
  esPorGrupoIndividual: boolean,
): { usaTerritorio: boolean; usaPuntoEncuentro: boolean; detallePorGrupo: boolean } {
  switch (modalidad) {
    case "cartas_presencial":
      return {
        usaTerritorio: true,
        usaPuntoEncuentro: !esPorGrupoIndividual,
        detallePorGrupo: !esPorGrupoIndividual,
      };
    case "telefono":
      return { usaTerritorio: false, usaPuntoEncuentro: false, detallePorGrupo: false };
    default:
      return { usaTerritorio: true, usaPuntoEncuentro: true, detallePorGrupo: true };
  }
}

/**
 * Tipo de la salida. Usa la columna `tipo_salida` cuando está presente; para
 * filas anteriores a esa columna cae en la derivación histórica (que no sabe
 * distinguir un individual sin asignaciones y por eso fue reemplazada).
 */
export function derivarTipoSalida(entrada: {
  tipo_salida?: TipoSalida | null;
  es_mensaje_especial?: boolean;
  es_por_grupos?: boolean;
  asignaciones_grupos?: AsignacionGrupo[] | null;
}): TipoSalida {
  if (entrada.tipo_salida) return entrada.tipo_salida;
  if (entrada.es_mensaje_especial) return "dia_especial";
  if (!entrada.es_por_grupos) return "sin_asignar";

  const asignaciones = entrada.asignaciones_grupos || [];
  const salidaIndexes = asignaciones.map((a) => a.salida_index);
  const todosConIndiceUnico =
    salidaIndexes.every((s) => s !== undefined && s !== null) &&
    new Set(salidaIndexes).size === asignaciones.length;
  const ningunoConIndice = salidaIndexes.every((s) => s === undefined || s === null);
  const esIndividual = asignaciones.length > 0 && (todosConIndiceUnico || ningunoConIndice);
  return esIndividual ? "por_grupo_individual" : "por_grupos";
}

/**
 * Salida por grupo individual en la que no se detalla nada grupo por grupo
 * (cartas presencial / teléfono). Se guarda como una sola fila y en el programa
 * se muestra como una línea única, con el superintendente de cada grupo a cargo.
 */
export function esIndividualSinDetalle(entrada: {
  tipo_salida?: TipoSalida | null;
  modalidad?: ModalidadSalida | null;
  es_mensaje_especial?: boolean;
  es_por_grupos?: boolean;
  asignaciones_grupos?: AsignacionGrupo[] | null;
}): boolean {
  if (derivarTipoSalida(entrada) !== "por_grupo_individual") return false;
  return !camposSegunModalidad(entrada.modalidad, true).detallePorGrupo;
}

export interface ProgramaPredicacion {
  id: string;
  fecha: string;
  tipo_salida?: TipoSalida | null;
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
