/**
 * Funciones que solo algunas congregaciones usan (p. ej. "Horario libre"). Su interruptor está
 * oculto: solo lo ven el super administrador y estas cuentas de pruebas.
 * No es una barrera de seguridad, solo evita que otras congregaciones vean la opción.
 */
const CUENTAS_FUNCIONES_ESPECIALES = ["miguelmevo@gmail.com", "miguelmevo@live.com"];

export function cuentaConFuncionesEspeciales(email?: string | null): boolean {
  return !!email && CUENTAS_FUNCIONES_ESPECIALES.includes(email.toLowerCase());
}
