// Helpers de visualización para participantes (incluye alias cuando existe).

export interface ParticipanteLike {
  nombre: string;
  apellido: string;
  alias?: string | null;
}

/** "Apellido, Nombre" o "Apellido, Nombre (alias)" */
export function formatNombreParticipante(p: ParticipanteLike): string {
  const base = `${p.apellido}, ${p.nombre}`;
  return p.alias && p.alias.trim() ? `${base} (${p.alias.trim()})` : base;
}

/** Normaliza: trim, lowercase y elimina diacríticos (tildes/acentos). */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

/** Detecta si dos personas tienen el mismo nombre+apellido (insensible a mayúsculas y acentos). */
export function mismoNombreApellido(
  a: { nombre: string; apellido: string },
  b: { nombre: string; apellido: string }
): boolean {
  return (
    normalizar(a.nombre) === normalizar(b.nombre) &&
    normalizar(a.apellido) === normalizar(b.apellido)
  );
}

/**
 * Devuelve el primer participante activo que choque por nombre+apellido,
 * excluyendo el id pasado (útil al editar).
 */
export function findDuplicateActivo<
  T extends { id: string; nombre: string; apellido: string; activo?: boolean }
>(participantes: T[], nombre: string, apellido: string, excludeId?: string): T | undefined {
  return participantes.find(
    (p) =>
      p.id !== excludeId &&
      (p.activo ?? true) &&
      mismoNombreApellido({ nombre: p.nombre, apellido: p.apellido }, { nombre, apellido })
  );
}
