import { getDay, parseISO } from "date-fns";

/** Días permitidos (0 = domingo … 6 = sábado) según la restricción de la ficha del participante. */
const RESTRICCIONES_DIAS: Record<string, number[]> = {
  sin_restriccion: [0, 1, 2, 3, 4, 5, 6],
  solo_fines_semana: [0, 6],
  solo_entre_semana: [1, 2, 3, 4, 5],
  solo_sabados: [6],
  solo_domingos: [0],
};

const ETIQUETAS: Record<string, string> = {
  solo_fines_semana: "Solo fines de semana",
  solo_entre_semana: "Solo entre semana",
  solo_sabados: "Solo sábados",
  solo_domingos: "Solo domingos",
};

/**
 * Motivo por el que la restricción de disponibilidad impide asignar en esa fecha
 * (yyyy-MM-dd), o null si puede.
 */
export function motivoRestriccion(restriccion: string | null | undefined, fecha: string): string | null {
  const clave = restriccion || "sin_restriccion";
  const dias = RESTRICCIONES_DIAS[clave];
  // parseISO y no new Date(): evita el desfase de zona horaria.
  if (!dias || dias.includes(getDay(parseISO(fecha)))) return null;
  return ETIQUETAS[clave];
}
