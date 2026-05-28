import type { ProgramaVidaMinisterio } from "@/types/vida-ministerio";

export type VymCategoria =
  | "presidente"
  | "oracion"
  | "tesoros"
  | "perlas"
  | "lectura_biblica"
  | "maestros"
  | "vida_cristiana"
  | "estudio_bc"
  | "lector_ebc";

export interface UltimaEntry {
  fecha: string;
  rol?: "T" | "A"; // sólo para "maestros"
}

export type UltimasPorParticipante = Map<
  string,
  Partial<Record<VymCategoria, UltimaEntry>>
>;

export const CATEGORIAS_ORDEN: VymCategoria[] = [
  "presidente",
  "oracion",
  "tesoros",
  "perlas",
  "lectura_biblica",
  "maestros",
  "vida_cristiana",
  "estudio_bc",
  "lector_ebc",
];

export const CATEGORIA_LABEL: Record<VymCategoria, string> = {
  presidente: "Presidente",
  oracion: "Oración",
  tesoros: "Tesoros",
  perlas: "Perlas",
  lectura_biblica: "Lectura Biblia",
  maestros: "Mejores Maestros",
  vida_cristiana: "Vida Cristiana",
  estudio_bc: "Estudio BC",
  lector_ebc: "Lector EBC",
};

export const CATEGORIA_LABEL_CORTO: Record<VymCategoria, string> = {
  presidente: "Pres.",
  oracion: "Oración",
  tesoros: "Tesoros",
  perlas: "Perlas",
  lectura_biblica: "Lectura B.",
  maestros: "Maestros",
  vida_cristiana: "Vida Crist.",
  estudio_bc: "Estudio BC",
  lector_ebc: "Lector EBC",
};

export function computeUltimasParticipaciones(
  programas: ProgramaVidaMinisterio[]
): UltimasPorParticipante {
  const map: UltimasPorParticipante = new Map();
  const ordenados = [...programas].sort((a, b) =>
    a.fecha_semana.localeCompare(b.fecha_semana)
  );

  const set = (
    id: string | null | undefined,
    cat: VymCategoria,
    fecha: string,
    rol?: "T" | "A"
  ) => {
    if (!id) return;
    const cur = map.get(id) ?? {};
    const prev = cur[cat];
    if (!prev || prev.fecha <= fecha) {
      cur[cat] = rol ? { fecha, rol } : { fecha };
      map.set(id, cur);
    }
  };

  for (const p of ordenados) {
    const f = p.fecha_semana;
    set(p.presidente_id, "presidente", f);
    set(p.oracion_inicial_id, "oracion", f);
    set(p.oracion_final_id, "oracion", f);
    set(p.tesoros?.participante_id, "tesoros", f);
    set(p.perlas_id, "perlas", f);
    set(p.lectura_biblica?.participante_id, "lectura_biblica", f);
    (p.maestros ?? []).forEach((m: any) => {
      set(m?.titular_id, "maestros", f, "T");
      set(m?.titular_sala_b_id, "maestros", f, "T");
      set(m?.titular_sala_c_id, "maestros", f, "T");
      set(m?.ayudante_id, "maestros", f, "A");
      set(m?.ayudante_sala_b_id, "maestros", f, "A");
      set(m?.ayudante_sala_c_id, "maestros", f, "A");
    });
    (p.vida_cristiana ?? []).forEach((v: any) =>
      set(v?.participante_id, "vida_cristiana", f)
    );
    set(p.estudio_biblico?.conductor_id, "estudio_bc", f);
    set(p.estudio_biblico?.lector_id, "estudio_bc", f);
    set(p.estudio_biblico?.lector_id, "lector_ebc", f);
  }
  return map;
}

export function ultimaGlobal(
  entry: Partial<Record<VymCategoria, UltimaEntry>> | undefined
): { fecha: string; categoria: VymCategoria; rol?: "T" | "A" } | null {
  if (!entry) return null;
  let best: { fecha: string; categoria: VymCategoria; rol?: "T" | "A" } | null = null;
  for (const cat of CATEGORIAS_ORDEN) {
    const e = entry[cat];
    if (e && (!best || e.fecha > best.fecha)) {
      best = { fecha: e.fecha, categoria: cat, rol: e.rol };
    }
  }
  return best;
}
