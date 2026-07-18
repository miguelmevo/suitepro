import { differenceInCalendarDays, parseISO } from "date-fns";
import type { RpCategoria, UltimaEntryRP } from "./reunion-publica-historial";
import { RP_CATEGORIA_LABEL } from "./reunion-publica-historial";

const CATEGORIAS_RP: RpCategoria[] = ["presidencia", "lector_atalaya"];

/** Semanas (enteras, hacia abajo) entre dos fechas ISO YYYY-MM-DD. fechaA debe ser >= fechaB. */
function semanasEntre(fechaA: string, fechaB: string): number {
  try {
    const dias = differenceInCalendarDays(parseISO(fechaA), parseISO(fechaB));
    return Math.floor(dias / 7);
  } catch {
    return 999;
  }
}

export interface BloqueoConfigRP {
  /** Semanas de la "ventana de rotación por categoría" (Presidencia y Lector Atalaya comparten una sola). */
  ventanaRotacionSemanas: number;
  /** Semanas de "descanso global" entre cualquier participación (Presidencia o Lector). */
  ventanaDescansoGlobalSemanas: number;
  /** Si false, la regla de rotación se muestra como aviso (marca) pero NO bloquea la selección. */
  rotacionActiva?: boolean;
  /** Si false, la regla de descanso se muestra como aviso (marca) pero NO bloquea la selección. */
  descansoActiva?: boolean;
}

export interface BloqueoResultadoRP {
  bloqueado: boolean;
  marcado: boolean;
  motivo?: "rotacion" | "descanso";
  detalle?: string;
}

/** Devuelve si el participante está bloqueado para asignarse en `categoria` durante la semana `fechaPrograma`. */
export function computeBloqueoRP(
  entry: Partial<Record<RpCategoria, UltimaEntryRP[]>> | undefined,
  categoria: RpCategoria,
  fechaPrograma: string,
  config: BloqueoConfigRP
): BloqueoResultadoRP {
  if (!entry) return { bloqueado: false, marcado: false };

  const rotActiva = config.rotacionActiva !== false;
  const descActiva = config.descansoActiva !== false;

  // 1) Rotación por categoría
  if (config.ventanaRotacionSemanas > 0) {
    const ult = entry[categoria]?.[0];
    if (ult && ult.fecha <= fechaPrograma) {
      const sem = semanasEntre(fechaPrograma, ult.fecha);
      if (sem < config.ventanaRotacionSemanas) {
        return {
          bloqueado: rotActiva,
          marcado: true,
          motivo: "rotacion",
          detalle: `${rotActiva ? "Bloqueado" : "Aviso"} por rotación: tuvo ${RP_CATEGORIA_LABEL[categoria]} hace ${sem} sem (mín. ${config.ventanaRotacionSemanas})`,
        };
      }
    }
  }

  // 2) Descanso global (entre Presidencia y Lector Atalaya combinados)
  if (config.ventanaDescansoGlobalSemanas > 0) {
    let mejor: { fecha: string; cat: RpCategoria } | null = null;
    for (const cat of CATEGORIAS_RP) {
      const e = entry[cat]?.[0];
      if (e && e.fecha <= fechaPrograma && (!mejor || e.fecha > mejor.fecha)) {
        mejor = { fecha: e.fecha, cat };
      }
    }
    if (mejor) {
      const sem = semanasEntre(fechaPrograma, mejor.fecha);
      if (sem < config.ventanaDescansoGlobalSemanas) {
        return {
          bloqueado: descActiva,
          marcado: true,
          motivo: "descanso",
          detalle: `${descActiva ? "Descanso" : "Aviso descanso"}: participó hace ${sem} sem (${RP_CATEGORIA_LABEL[mejor.cat]}); mín. ${config.ventanaDescansoGlobalSemanas} sem entre asignaciones`,
        };
      }
    }
  }

  return { bloqueado: false, marcado: false };
}

export function aplicarUmbralRelajacionRP(totalDisponibles: number, umbral: number): { permitirBloqueados: boolean } {
  return { permitirBloqueados: totalDisponibles < umbral };
}

/** Helper para leer la config desde el array de configuracion_sistema (programa_tipo reunion_publica). */
export function leerBloqueoConfigRP(
  configuraciones: Array<{ clave: string; valor: Record<string, any> }> | undefined | null
): BloqueoConfigRP & { umbralRelajacion: number } {
  const get = (clave: string) => configuraciones?.find((c) => c.clave === clave)?.valor;
  const rot = get("ventana_rotacion_semanas") as any;
  const desc = get("ventana_descanso_global_semanas") as any;
  const umb = get("umbral_relajacion_seleccion") as any;
  const num = (v: any, def: number) => {
    const n = typeof v === "number" ? v : parseInt(v, 10);
    return isNaN(n) || n < 0 ? def : n;
  };
  return {
    ventanaRotacionSemanas: num(rot?.semanas, 8),
    ventanaDescansoGlobalSemanas: num(desc?.semanas, 0),
    rotacionActiva: rot?.activo !== false,
    descansoActiva: desc?.activo !== false,
    umbralRelajacion: num(umb?.cantidad, 5),
  };
}
