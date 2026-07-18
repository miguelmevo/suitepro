import type { ProgramaReunionPublica } from "@/hooks/useReunionPublica";

export type RpCategoria = "presidencia" | "lector_atalaya" | "orador";

export const RP_CATEGORIA_LABEL: Record<RpCategoria, string> = {
  presidencia: "Presidencia",
  lector_atalaya: "Lector de la Atalaya",
  orador: "Orador (local)",
};

export interface UltimaEntryRP {
  fecha: string;
}

export type UltimasPorParticipanteRP = Map<string, Partial<Record<RpCategoria, UltimaEntryRP[]>>>;

/** Recorre los programas guardados (todo el historial) y arma, por participante, las últimas 2 fechas por categoría. */
export function computeUltimasParticipacionesRP(
  programas: ProgramaReunionPublica[] | undefined | null
): UltimasPorParticipanteRP {
  const map: UltimasPorParticipanteRP = new Map();
  if (!programas || programas.length === 0) return map;

  const ordenados = [...programas].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const push = (id: string | null, cat: RpCategoria, fecha: string) => {
    if (!id) return;
    const entry = map.get(id) ?? {};
    const arr = entry[cat] ?? [];
    if (arr.length < 2) {
      arr.push({ fecha });
      entry[cat] = arr;
      map.set(id, entry);
    }
  };

  for (const p of ordenados) {
    push(p.presidente_id, "presidencia", p.fecha);
    push(p.lector_atalaya_id, "lector_atalaya", p.fecha);
    // orador_id solo queda asignado cuando el orador es de la congregación (local).
    push(p.orador_id, "orador", p.fecha);
  }

  return map;
}
