/**
 * Devuelve el nombre del participante priorizando el snapshot guardado en el programa.
 * Útil para que los nombres de programas cerrados/pasados no cambien aunque
 * el participante haya sido renombrado, inactivado o eliminado.
 */
export function getNombreSnapshot(
  participanteId: string | null | undefined,
  snapshot: Record<string, string> | null | undefined,
  participantes: Array<{ id: string; nombre?: string | null; apellido?: string | null }> | null | undefined,
  fallback: string = "—"
): string {
  if (!participanteId) return fallback;

  // Buscar primero en participantes activos
  const p = participantes?.find((x) => x.id === participanteId);
  if (p) {
    const full = `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim();
    if (full) return full;
  }

  // Fallback al snapshot
  const snap = snapshot?.[participanteId];
  if (snap && snap.trim()) return snap.trim();

  return fallback;
}
