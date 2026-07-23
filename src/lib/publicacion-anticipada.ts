export interface ConfigPublicacionAnticipada {
  activo: boolean;
  dia: number;
}

export function debeMostrarMesSiguiente(
  config: ConfigPublicacionAnticipada | undefined,
  hoy: Date = new Date(),
): boolean {
  if (!config?.activo) return false;
  return hoy.getDate() >= config.dia;
}
