export type ProgramaTipoCierre = "asignaciones" | "vida_ministerio" | "reunion_publica" | "predicacion";

export interface ConfiguracionCierre {
  diaCierre: number;
  cierreActivo: boolean;
}

function calcBloqueo(
  fecha: Date | string | null | undefined,
  diaCierre: number,
  cierreActivo: boolean,
  esSuperAdmin: boolean
) {
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

function extraerConfigCierre(
  configuraciones: any[] | undefined,
  tipo: ProgramaTipoCierre
): ConfiguracionCierre {
  const cierreCfg = configuraciones?.find(
    (c) => c.programa_tipo === tipo && c.clave === "cierre_automatico"
  );
  return {
    cierreActivo: (cierreCfg?.valor as any)?.activo ?? true,
    diaCierre: Number((cierreCfg?.valor as any)?.dia) || 20,
  };
}

/**
 * Hook de conveniencia: recibe configuraciones ya cargadas externamente
 * para evitar dependencias circulares en el bundle de producción.
 */
export function useProgramaBloqueado(
  fecha: Date | string | null | undefined,
  programaTipo: ProgramaTipoCierre,
  isSuperAdminFn: (() => boolean) | boolean,
  configuraciones?: any[]
) {
  const esSuperAdmin =
    typeof isSuperAdminFn === "function" ? isSuperAdminFn() : isSuperAdminFn;
  const { diaCierre, cierreActivo } = extraerConfigCierre(configuraciones, programaTipo);
  return calcBloqueo(fecha, diaCierre, cierreActivo, esSuperAdmin);
}

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
