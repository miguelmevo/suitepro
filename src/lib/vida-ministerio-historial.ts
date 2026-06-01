import type { ProgramaVidaMinisterio } from "@/types/vida-ministerio";

export type VymCategoria =
  | "presidente"
  | "oracion_inicial"
  | "oracion_final"
  | "tesoros"
  | "perlas"
  | "lectura_biblica"
  | "maestros"
  | "discurso"
  | "vida_cristiana"
  | "necesidades_congregacion"
  | "estudio_bc"
  | "lector_ebc";

export interface UltimaEntry {
  fecha: string;
  rol?: "T" | "A"; // sólo para "maestros"
}

/** Para cada categoría guardamos hasta las 2 fechas más recientes (índice 0 = más reciente). */
export type UltimasPorParticipante = Map<
  string,
  Partial<Record<VymCategoria, UltimaEntry[]>>
>;

export const CATEGORIAS_ORDEN: VymCategoria[] = [
  "presidente",
  "oracion_inicial",
  "oracion_final",
  "tesoros",
  "perlas",
  "lectura_biblica",
  "maestros",
  "discurso",
  "vida_cristiana",
  "necesidades_congregacion",
  "estudio_bc",
  "lector_ebc",
];

export const CATEGORIA_LABEL: Record<VymCategoria, string> = {
  presidente: "Presidente",
  oracion_inicial: "Oración inicial",
  oracion_final: "Oración final",
  tesoros: "Tesoros",
  perlas: "Perlas",
  lectura_biblica: "Lectura Biblia",
  maestros: "Mejores Maestros",
  discurso: "Discurso",
  vida_cristiana: "Vida Cristiana",
  necesidades_congregacion: "Necesidades Congregación",
  estudio_bc: "Estudio BC",
  lector_ebc: "Lector EBC",
};

export const CATEGORIA_LABEL_CORTO: Record<VymCategoria, string> = {
  presidente: "Pres.",
  oracion_inicial: "Or. inicial",
  oracion_final: "Or. final",
  tesoros: "Tesoros",
  perlas: "Perlas",
  lectura_biblica: "Lectura B.",
  maestros: "Maestros",
  discurso: "Discurso",
  vida_cristiana: "Vida Crist.",
  necesidades_congregacion: "Nec. Cong.",
  estudio_bc: "Estudio BC",
  lector_ebc: "Lector EBC",
};

/** Detecta si el título corresponde a "Necesidades de la congregación" (insensible a tildes/mayúsculas). */
export function esNecesidadesCongregacion(titulo: string | undefined | null): boolean {
  if (!titulo) return false;
  const norm = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return norm.includes("necesidades de la congregacion");
}

export function computeUltimasParticipaciones(
  programas: ProgramaVidaMinisterio[]
): UltimasPorParticipante {
  const map: UltimasPorParticipante = new Map();
  // Orden DESC: las más recientes primero
  const ordenados = [...programas].sort((a, b) =>
    b.fecha_semana.localeCompare(a.fecha_semana)
  );

  const push = (
    id: string | null | undefined,
    cat: VymCategoria,
    fecha: string,
    rol?: "T" | "A"
  ) => {
    if (!id) return;
    const cur = map.get(id) ?? {};
    const arr = cur[cat] ?? [];
    if (arr.length >= 2) return; // ya tenemos las 2 más recientes
    if (arr.some((e) => e.fecha === fecha && e.rol === rol)) return;
    arr.push(rol ? { fecha, rol } : { fecha });
    cur[cat] = arr;
    map.set(id, cur);
  };

  for (const p of ordenados) {
    const f = p.fecha_semana;
    push(p.presidente_id, "presidente", f);
    push(p.oracion_inicial_id, "oracion_inicial", f);
    push(p.oracion_final_id, "oracion_final", f);
    push(p.tesoros?.participante_id, "tesoros", f);
    push(p.perlas_id, "perlas", f);
    push(p.lectura_biblica?.participante_id, "lectura_biblica", f);
    (p.maestros ?? []).forEach((m: any) => {
      if (m?.tipo === "discurso") {
        // Discurso: solo va en columna "discurso" (nunca tiene ayudante)
        push(m?.titular_id, "discurso", f);
        push(m?.titular_sala_b_id, "discurso", f);
        push(m?.titular_sala_c_id, "discurso", f);
      } else {
        push(m?.titular_id, "maestros", f, "T");
        push(m?.titular_sala_b_id, "maestros", f, "T");
        push(m?.titular_sala_c_id, "maestros", f, "T");
        push(m?.ayudante_id, "maestros", f, "A");
        push(m?.ayudante_sala_b_id, "maestros", f, "A");
        push(m?.ayudante_sala_c_id, "maestros", f, "A");
      }
    });
    (p.vida_cristiana ?? []).forEach((v: any) => {
      if (esNecesidadesCongregacion(v?.titulo)) {
        push(v?.participante_id, "necesidades_congregacion", f);
      } else {
        push(v?.participante_id, "vida_cristiana", f);
      }
    });
    push(p.estudio_biblico?.conductor_id, "estudio_bc", f);
    push(p.estudio_biblico?.lector_id, "estudio_bc", f);
    push(p.estudio_biblico?.lector_id, "lector_ebc", f);
  }
  return map;
}

/** Devuelve la entrada global más reciente (entre todas las categorías) para un participante. */
export function ultimaGlobal(
  entry: Partial<Record<VymCategoria, UltimaEntry[]>> | undefined
): { fecha: string; categoria: VymCategoria; rol?: "T" | "A" } | null {
  if (!entry) return null;
  let best: { fecha: string; categoria: VymCategoria; rol?: "T" | "A" } | null = null;
  for (const cat of CATEGORIAS_ORDEN) {
    const arr = entry[cat];
    const e = arr?.[0];
    if (e && (!best || e.fecha > best.fecha)) {
      best = { fecha: e.fecha, categoria: cat, rol: e.rol };
    }
  }
  return best;
}

/** Fecha global más reciente (string ISO) o null si nunca ha participado. Útil para ordenar. */
export function ultimaFechaGlobal(
  entry: Partial<Record<VymCategoria, UltimaEntry[]>> | undefined
): string | null {
  return ultimaGlobal(entry)?.fecha ?? null;
}
