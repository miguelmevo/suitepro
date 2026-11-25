import type { Participante } from "@/types/grupos-servicio";

/**
 * ¿Puede esta persona ser capitán de una salida con estos grupos?
 *  - Interruptor "Asociar grupos" apagado, o sin grupos elegidos: cualquier capitán.
 *  - Encendido: solo los capitanes de los grupos que salen juntos.
 *  - El Superintendente de Circuito puede serlo siempre.
 */
export function puedeSerCapitan(p: Participante, grupoIds: string[], asociacionHabilitada: boolean): boolean {
  if (p.activo !== false && p.responsabilidad?.includes("super_circuito")) return true;
  if (!p.es_capitan_grupo) return false;
  if (!asociacionHabilitada || grupoIds.length === 0) return true;
  return !!p.grupo_predicacion_id && grupoIds.includes(p.grupo_predicacion_id);
}

/** Filtro activo y los grupos elegidos no tienen ningún capitán propio. */
export function gruposSinCapitanes(participantes: Participante[], grupoIds: string[], asociacionHabilitada: boolean): boolean {
  return (
    asociacionHabilitada &&
    grupoIds.length > 0 &&
    !participantes.some((p) => p.es_capitan_grupo && !!p.grupo_predicacion_id && grupoIds.includes(p.grupo_predicacion_id))
  );
}

export function ordenarPorApellido<T extends { nombre: string; apellido: string }>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) => (a.apellido || "").localeCompare(b.apellido || "") || (a.nombre || "").localeCompare(b.nombre || ""),
  );
}
