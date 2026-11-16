/** Versión vigente del texto de consentimiento (política de privacidad + términos). Subirla vuelve a pedir la aceptación. */
export const VERSION_CONSENTIMIENTO = "1.0";

/**
 * Por defecto el consentimiento es OBLIGATORIO en todas las congregaciones (un administrador puede
 * desactivarlo en Ajustes del Sistema). Rige desde el 16-nov-2026 00:00 (hora de Chile), la fecha
 * informada a los usuarios por correo.
 */
export const INICIO_CONSENTIMIENTO_OBLIGATORIO = new Date("2026-11-16T00:00:00-03:00").getTime();

/** Valor efectivo: lo configurado por la congregación, o el obligatorio por defecto si no hay configuración. */
export function consentimientoObligatorioEfectivo(configurado: boolean | undefined): boolean {
  return configurado === undefined ? Date.now() >= INICIO_CONSENTIMIENTO_OBLIGATORIO : configurado === true;
}

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
