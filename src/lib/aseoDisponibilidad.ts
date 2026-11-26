export type ReunionAseo = {
  /** Cómo nombrarla en el aviso, ej. "sábado 5". */
  nombre: string;
  grupos: Set<string>;
};

export type MotivoGrupoAseo = { texto: string; bloqueado: boolean };

/**
 * Disponibilidad de cada grupo para una casilla de Aseo:
 * - nunca se repite en dos casillas de la misma reunión;
 * - tampoco se elige si ya tiene Aseo en la reunión anterior o en la siguiente,
 *   salvo que no quede ningún grupo libre: ahí se permite, con advertencia.
 * Devuelve solo los grupos que tienen algún motivo.
 */
export function motivosGruposAseo(
  grupoIds: string[],
  otrasCasillasDelDia: Set<string>,
  vecinas: ReunionAseo[],
): Map<string, MotivoGrupoAseo> {
  const enVecinas = (id: string) => vecinas.filter((v) => v.grupos.has(id)).map((v) => v.nombre);
  const quedaLibre = grupoIds.some((id) => !otrasCasillasDelDia.has(id) && enVecinas(id).length === 0);

  const motivos = new Map<string, MotivoGrupoAseo>();
  for (const id of grupoIds) {
    if (otrasCasillasDelDia.has(id)) {
      motivos.set(id, { texto: "Ya asignado hoy", bloqueado: true });
      continue;
    }
    const nombres = enVecinas(id);
    if (nombres.length > 0) {
      motivos.set(id, { texto: `Aseo el ${nombres.join(" y el ")}`, bloqueado: quedaLibre });
    }
  }
  return motivos;
}
