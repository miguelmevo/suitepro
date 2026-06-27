import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useAuthContext } from "@/contexts/AuthProvider";

export type ProgramaTipoCierre = "asignaciones" | "vida_ministerio" | "reunion_publica" | "predicacion";

/**
 * Determina si un programa está cerrado por fecha.
 * Regla fija: mes anterior SIEMPRE bloqueado.
 * Cierre automático del mes en curso: configurable por tipo de programa (toggle + día).
 * Solo super_admin puede editar programas bloqueados por fecha.
 */
export function useProgramaBloqueado(
  fecha?: Date | string | null,
  programaTipo?: ProgramaTipoCierre
) {
  const tipo = programaTipo ?? "predicacion";
  const { configuraciones } = useConfiguracionSistema(tipo);
  const { isSuperAdmin } = useAuthContext();

  const cierreCfg = configuraciones?.find(
    (c) => c.programa_tipo === tipo && c.clave === "cierre_automatico"
  );

  const cierreActivo: boolean = (cierreCfg?.valor as any)?.activo ?? true;
  const diaCierre: number = Number((cierreCfg?.valor as any)?.dia) || 20;

  let bloqueadoPorMesAnterior = false;
  let bloqueadoPorFecha = false;

  if (fecha) {
    const f =
      typeof fecha === "string"
        ? new Date(fecha + (fecha.length === 10 ? "T00:00:00" : ""))
        : fecha;
    const hoy = new Date();
    const mesF = new Date(f.getFullYear(), f.getMonth(), 1).getTime();
    const mesH = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();

    if (mesF < mesH) {
      bloqueadoPorMesAnterior = true;
    } else if (mesF === mesH && cierreActivo && hoy.getDate() >= diaCierre) {
      bloqueadoPorFecha = true;
    }
  }

  const bloqueado = bloqueadoPorMesAnterior || bloqueadoPorFecha;
  const esSuperAdmin = isSuperAdmin();

  return {
    diaCierre,
    cierreActivo,
    bloqueado,
    bloqueadoPorMesAnterior,
    bloqueadoPorFecha,
    puedeEditar: !bloqueado || esSuperAdmin,
    esSuperAdmin,
    mensaje: bloqueadoPorMesAnterior
      ? "El mes anterior está cerrado permanentemente."
      : bloqueadoPorFecha
      ? `Programa cerrado desde el día ${diaCierre} del mes. Solo un super administrador puede modificarlo.`
      : "",
  };
}

/**
 * Versión helper para verificar si un mes está bloqueado por fecha
 * sin necesitar el hook completo (para uso en listas/historial).
 */
export function isMesBloqueadoPorFecha(
  mes: Date,
  diaCierre: number,
  cierreActivo: boolean
): boolean {
  const hoy = new Date();
  const mesF = new Date(mes.getFullYear(), mes.getMonth(), 1).getTime();
  const mesH = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();
  if (mesF < mesH) return true;
  if (mesF === mesH && cierreActivo && hoy.getDate() >= diaCierre) return true;
  return false;
}

/** @deprecated usar isMesBloqueadoPorFecha */
export function isMesBloqueado(mes: Date, diaCierre: number): boolean {
  return isMesBloqueadoPorFecha(mes, diaCierre, true);
}
