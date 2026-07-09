import { differenceInCalendarDays, parseISO } from "date-fns";
import type { VymCategoria, UltimaEntry, UltimasPorParticipante } from "./vida-ministerio-historial";
import { CATEGORIAS_ORDEN, CATEGORIA_LABEL_CORTO } from "./vida-ministerio-historial";

/**
 * Categorías de oración: exentas de todas las reglas de bloqueo
 * (no aplican rotación por categoría ni descanso global, y no cuentan para el descanso global de otras).
 */
const CATEGORIAS_ORACION: VymCategoria[] = ["oracion_inicial", "oracion_final"];

export function esCategoriaOracion(cat: VymCategoria): boolean {
  return CATEGORIAS_ORACION.includes(cat);
}

/** Semanas (enteras, hacia abajo) entre dos fechas ISO YYYY-MM-DD. fechaA debe ser >= fechaB. */
function semanasEntre(fechaA: string, fechaB: string): number {
  try {
    const dias = differenceInCalendarDays(parseISO(fechaA), parseISO(fechaB));
    return Math.floor(dias / 7);
  } catch {
    return 999;
  }
}

export interface BloqueoConfig {
  /** Semanas de la "ventana de rotación por categoría". 0 o negativo = desactivado. */
  ventanaRotacionSemanas: number;
  /** Semanas de "descanso global" entre cualquier participación (excluye oraciones). 0 = desactivado. */
  ventanaDescansoGlobalSemanas: number;
}

export interface BloqueoResultado {
  bloqueado: boolean;
  /** "rotacion" si choca con la ventana de la misma categoría, "descanso" si choca con el descanso global. */
  motivo?: "rotacion" | "descanso";
  /** Texto amigable para el tooltip. */
  detalle?: string;
}

/**
 * Devuelve si el participante está bloqueado para asignarse en `categoria` durante la semana `fechaPrograma`.
 * Las oraciones (inicial/final) nunca se bloquean y nunca cuentan para el descanso global.
 */
export function computeBloqueo(
  entry: Partial<Record<VymCategoria, UltimaEntry[]>> | undefined,
  categoria: VymCategoria,
  fechaPrograma: string,
  config: BloqueoConfig
): BloqueoResultado {
  // Oraciones: siempre disponibles
  if (esCategoriaOracion(categoria)) return { bloqueado: false };
  if (!entry) return { bloqueado: false };

  // 1) Rotación por categoría
  if (config.ventanaRotacionSemanas > 0) {
    const arr = entry[categoria];
    const ult = arr?.[0];
    if (ult && ult.fecha <= fechaPrograma) {
      const sem = semanasEntre(fechaPrograma, ult.fecha);
      if (sem < config.ventanaRotacionSemanas) {
        return {
          bloqueado: true,
          motivo: "rotacion",
          detalle: `Bloqueado por rotación: tuvo ${CATEGORIA_LABEL_CORTO[categoria]} hace ${sem} sem (mín. ${config.ventanaRotacionSemanas})`,
        };
      }
    }
  }

  // 2) Descanso global (excluye oraciones)
  if (config.ventanaDescansoGlobalSemanas > 0) {
    let mejor: { fecha: string; cat: VymCategoria } | null = null;
    for (const cat of CATEGORIAS_ORDEN) {
      if (esCategoriaOracion(cat)) continue;
      const e = entry[cat]?.[0];
      if (e && e.fecha <= fechaPrograma && (!mejor || e.fecha > mejor.fecha)) {
        mejor = { fecha: e.fecha, cat };
      }
    }
    if (mejor) {
      const sem = semanasEntre(fechaPrograma, mejor.fecha);
      if (sem < config.ventanaDescansoGlobalSemanas) {
        return {
          bloqueado: true,
          motivo: "descanso",
          detalle: `Descanso: participó hace ${sem} sem (${CATEGORIA_LABEL_CORTO[mejor.cat]}); mín. ${config.ventanaDescansoGlobalSemanas} sem entre asignaciones`,
        };
      }
    }
  }

  return { bloqueado: false };
}

/**
 * Aplica el umbral de relajación 2B: si el número de participantes NO bloqueados
 * es >= umbral, los bloqueados quedan no seleccionables. Si es menor, se permiten
 * con un aviso visual.
 */
export function aplicarUmbralRelajacion(
  bloqueosPorId: Map<string, BloqueoResultado>,
  totalDisponibles: number,
  umbral: number
): { permitirBloqueados: boolean } {
  return { permitirBloqueados: totalDisponibles < umbral };
}

/** Helper para leer la config desde el array de configuracion_sistema (programa_tipo vida_ministerio). */
export function leerBloqueoConfig(
  configuraciones:
    | Array<{ clave: string; valor: Record<string, any> }>
    | undefined
    | null
): BloqueoConfig & { umbralRelajacion: number } {
  const get = (clave: string) => configuraciones?.find((c) => c.clave === clave)?.valor;
  const rot = get("ventana_rotacion_semanas") as any;
  const desc = get("ventana_descanso_global_semanas") as any;
  const umb = get("umbral_relajacion_seleccion") as any;
  const num = (v: any, def: number) => {
    const n = typeof v === "number" ? v : parseInt(v, 10);
    return isNaN(n) || n < 0 ? def : n;
  };
  // Un flag `activo === false` desactiva el bloqueo de esa regla sin perder el número
  // configurado (se trata como 0 semanas). Las marcas de uso no se ven afectadas.
  const rotActiva = rot?.activo !== false;
  const descActivo = desc?.activo !== false;
  return {
    ventanaRotacionSemanas: rotActiva ? num(rot?.semanas, 8) : 0,
    ventanaDescansoGlobalSemanas: descActivo ? num(desc?.semanas, 0) : 0,
    umbralRelajacion: num(umb?.cantidad, 5),
  };
}
