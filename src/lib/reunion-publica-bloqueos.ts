import { differenceInCalendarDays, parseISO } from "date-fns";
import type { RpCategoria, UltimaEntryRP } from "./reunion-publica-historial";
import { RP_CATEGORIA_LABEL } from "./reunion-publica-historial";

const CATEGORIAS_RP: RpCategoria[] = ["presidencia", "lector_atalaya"];

/** Semanas (enteras) de distancia entre dos fechas ISO YYYY-MM-DD, sin importar el orden. */
function semanasEntre(fechaA: string, fechaB: string): number {
  try {
    const dias = Math.abs(differenceInCalendarDays(parseISO(fechaA), parseISO(fechaB)));
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

  // 1) Rotación por categoría — considera la ocurrencia más cercana en el tiempo,
  // sea pasada o futura (ej.: al editar una semana anterior dentro del mismo
  // programa, una asignación posterior ya guardada también debe contar).
  if (config.ventanaRotacionSemanas > 0) {
    const candidatas = entry[categoria] || [];
    let masCercana: { fecha: string; sem: number } | null = null;
    for (const c of candidatas) {
      const sem = semanasEntre(fechaPrograma, c.fecha);
      if (!masCercana || sem < masCercana.sem) masCercana = { fecha: c.fecha, sem };
    }
    if (masCercana && masCercana.sem < config.ventanaRotacionSemanas) {
      const direccion = masCercana.fecha < fechaPrograma ? "hace" : "en";
      return {
        bloqueado: rotActiva,
        marcado: true,
        motivo: "rotacion",
        detalle: `${rotActiva ? "Bloqueado" : "Aviso"} por rotación: tuvo ${RP_CATEGORIA_LABEL[categoria]} ${direccion} ${masCercana.sem} sem (mín. ${config.ventanaRotacionSemanas})`,
      };
    }
  }

  // 2) Descanso global (entre Presidencia y Lector Atalaya combinados)
  if (config.ventanaDescansoGlobalSemanas > 0) {
    let mejor: { fecha: string; cat: RpCategoria; sem: number } | null = null;
    for (const cat of CATEGORIAS_RP) {
      for (const e of entry[cat] || []) {
        const sem = semanasEntre(fechaPrograma, e.fecha);
        if (!mejor || sem < mejor.sem) mejor = { fecha: e.fecha, cat, sem };
      }
    }
    if (mejor && mejor.sem < config.ventanaDescansoGlobalSemanas) {
      const direccion = mejor.fecha < fechaPrograma ? "hace" : "en";
      return {
        bloqueado: descActiva,
        marcado: true,
        motivo: "descanso",
        detalle: `${descActiva ? "Descanso" : "Aviso descanso"}: participó ${direccion} ${mejor.sem} sem (${RP_CATEGORIA_LABEL[mejor.cat]}); mín. ${config.ventanaDescansoGlobalSemanas} sem entre asignaciones`,
      };
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
