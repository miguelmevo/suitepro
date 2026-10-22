/** Versión vigente del texto de consentimiento (política de privacidad + términos). Subirla vuelve a pedir la aceptación. */
export const VERSION_CONSENTIMIENTO = "1.0";

/** Cada cuántos días se vuelve a abrir el cuadro de consentimiento si quedó pendiente (al abrir la app). */
export const DIAS_RECORDATORIO_CONSENTIMIENTO = 3;

/** Evento para abrir el cuadro de consentimiento desde otra parte (la campana de avisos). */
export const EVENTO_ABRIR_CONSENTIMIENTO = "suitepro:abrir-consentimiento";

const claveRecordado = (userId: string) => `suitepro-consentimiento-recordado-${userId}`;

/** true si el cuadro ya se mostró (y se dejó para después) hace menos de 3 días. */
export function recordadoRecientemente(userId: string): boolean {
  try {
    const t = Number(localStorage.getItem(claveRecordado(userId)));
    return !!t && Date.now() - t < DIAS_RECORDATORIO_CONSENTIMIENTO * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function marcarRecordado(userId: string) {
  try {
    localStorage.setItem(claveRecordado(userId), String(Date.now()));
  } catch {
    /* sin almacenamiento: se vuelve a mostrar al abrir */
  }
}
