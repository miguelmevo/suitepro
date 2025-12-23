/**
 * Utility functions for consistent sorting across the application
 */

/**
 * Sort territory numbers in correct numerical order
 * Handles mixed numeric and alphanumeric cases (1, 2, 10, 11, A, B)
 */
export function sortTerritorioNumeros(numeros: (string | undefined | null)[]): string[] {
  return numeros
    .filter((n): n is string => n != null)
    .sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      
      // Both are numbers - sort numerically
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      
      // One is number, other is not - numbers first
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      
      // Both are strings - sort alphabetically
      return a.localeCompare(b);
    });
}

/**
 * Format participant name as "Apellido, Nombre"
 */
export function formatParticipanteApellidoNombre(
  participante: { nombre?: string | null; apellido?: string | null } | null | undefined
): string {
  if (!participante) return "";
  const apellido = participante.apellido || "";
  const nombre = participante.nombre || "";
  return `${apellido}, ${nombre}`.trim();
}

/**
 * Format participant name as "Nombre Apellido"
 */
export function formatParticipanteNombreApellido(
  participante: { nombre?: string | null; apellido?: string | null } | null | undefined
): string {
  if (!participante) return "";
  const nombre = participante.nombre || "";
  const apellido = participante.apellido || "";
  return `${nombre} ${apellido}`.trim();
}

/**
 * Sort participants by apellido, then nombre
 */
export function sortParticipantes<T extends { apellido?: string | null; nombre?: string | null }>(
  participantes: T[]
): T[] {
  return [...participantes].sort((a, b) => {
    const apellidoCompare = (a.apellido || "").localeCompare(b.apellido || "");
    if (apellidoCompare !== 0) return apellidoCompare;
    return (a.nombre || "").localeCompare(b.nombre || "");
  });
}
