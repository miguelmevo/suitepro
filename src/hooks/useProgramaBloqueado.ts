import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useAuthContext } from "@/contexts/AuthProvider";

/**
 * Determina si un programa de una fecha dada está cerrado para edición.
 * Regla: mes anterior al actual SIEMPRE bloqueado; mes en curso bloqueado a partir
 * del día configurado (default 20). Solo super_admin puede saltarse el bloqueo.
 */
export function useProgramaBloqueado(fecha?: Date | string | null) {
  const { configuraciones } = useConfiguracionSistema("general");
  const { isSuperAdmin } = useAuthContext();

  const cierreCfg = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dia_cierre_programas"
  );
  const diaCierre = Number((cierreCfg?.valor as any)?.dia) || 20;

  let bloqueado = false;
  if (fecha) {
    const f = typeof fecha === "string" ? new Date(fecha + (fecha.length === 10 ? "T00:00:00" : "")) : fecha;
    const hoy = new Date();
    const mesF = new Date(f.getFullYear(), f.getMonth(), 1).getTime();
    const mesH = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();
    if (mesF < mesH) bloqueado = true;
    else if (mesF === mesH && hoy.getDate() >= diaCierre) bloqueado = true;
  }

  const esSuperAdmin = isSuperAdmin();
  return {
    diaCierre,
    bloqueado,
    puedeEditar: !bloqueado || esSuperAdmin,
    esSuperAdmin,
    mensaje: bloqueado
      ? `Programa cerrado a partir del día ${diaCierre} del mes. Solo un super administrador puede modificarlo.`
      : "",
  };
}

/**
 * Variante para un mes específico (cuando los programas se gestionan por mes).
 * Recibe un Date que represente cualquier día dentro del mes.
 */
export function isMesBloqueado(mes: Date, diaCierre: number): boolean {
  const hoy = new Date();
  const mesF = new Date(mes.getFullYear(), mes.getMonth(), 1).getTime();
  const mesH = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();
  if (mesF < mesH) return true;
  if (mesF === mesH && hoy.getDate() >= diaCierre) return true;
  return false;
}
