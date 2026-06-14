// Catálogo de módulos y acciones del sistema de permisos granulares.
// Cada módulo representa una pantalla o pestaña independiente. Cada usuario
// puede tener permisos diferentes (ver / crear / editar / eliminar) en cada
// módulo. Ver `has_permission` en la base de datos para la lógica completa
// (incluye fallback a los roles legacy).

export type ModuloPermiso =
  | "inicio"
  | "programas_del_mes"
  | "predicacion_programa"
  | "predicacion_capitanes"
  | "predicacion_puntos"
  | "predicacion_carritos"
  | "predicacion_territorios"
  | "predicacion_territorios_historial"
  | "predicacion_historial"
  | "reunion_publica_programa"
  | "reunion_publica_lectores"
  | "vym_programa"
  | "vym_lectores_ebc"
  | "vym_historial"
  | "asignaciones_servicio"
  | "configuracion_participantes"
  | "configuracion_grupos"
  | "configuracion_dias_especiales"
  | "ajustes_general"
  | "ajustes_asignaciones"
  | "ajustes_vida_ministerio"
  | "ajustes_reunion_publica"
  | "ajustes_predicacion"
  | "ajustes_carritos"
  | "configuracion_usuarios"
  | "cierre_vym"
  | "cierre_reunion_publica"
  | "cierre_asignaciones_servicio"
  | "cierre_predicacion";

export type AccionPermiso = "ver" | "crear" | "editar" | "eliminar";

export interface ModuloDef {
  id: ModuloPermiso;
  label: string;
  grupo: string;
}

// Orden y agrupación visual para la matriz
export const MODULOS: ModuloDef[] = [
  { id: "inicio", label: "Inicio", grupo: "General" },
  { id: "programas_del_mes", label: "Programas del Mes", grupo: "General" },

  { id: "predicacion_programa", label: "Programa mensual", grupo: "Predicación" },
  { id: "predicacion_capitanes", label: "Disponibilidad capitanes", grupo: "Predicación" },
  { id: "predicacion_puntos", label: "Puntos de encuentro", grupo: "Predicación" },
  { id: "predicacion_carritos", label: "Carritos", grupo: "Predicación" },
  { id: "predicacion_territorios", label: "Territorios", grupo: "Predicación" },
  { id: "predicacion_territorios_historial", label: "Historial de territorios", grupo: "Predicación" },
  { id: "predicacion_historial", label: "Historial de programas", grupo: "Predicación" },

  { id: "reunion_publica_programa", label: "Programa", grupo: "Reunión Pública" },
  { id: "reunion_publica_lectores", label: "Lectores Atalaya", grupo: "Reunión Pública" },

  { id: "vym_programa", label: "Programa VyM", grupo: "Vida y Ministerio" },
  { id: "vym_lectores_ebc", label: "Lectores EBC", grupo: "Vida y Ministerio" },
  { id: "vym_historial", label: "Historial VyM", grupo: "Vida y Ministerio" },

  { id: "asignaciones_servicio", label: "Asignaciones de Servicio", grupo: "Servicio" },

  { id: "configuracion_participantes", label: "Participantes", grupo: "Configuración" },
  { id: "configuracion_grupos", label: "Grupos de predicación", grupo: "Configuración" },
  { id: "configuracion_dias_especiales", label: "Días e indisponibilidad", grupo: "Configuración" },
  { id: "configuracion_usuarios", label: "Usuarios y permisos", grupo: "Configuración" },

  { id: "ajustes_general", label: "General", grupo: "Ajustes del sistema" },
  { id: "ajustes_asignaciones", label: "Asignaciones", grupo: "Ajustes del sistema" },
  { id: "ajustes_vida_ministerio", label: "Vida y Ministerio", grupo: "Ajustes del sistema" },
  { id: "ajustes_reunion_publica", label: "Reunión Pública", grupo: "Ajustes del sistema" },
  { id: "ajustes_predicacion", label: "Predicación", grupo: "Ajustes del sistema" },
  { id: "ajustes_carritos", label: "Carritos", grupo: "Ajustes del sistema" },

  { id: "cierre_vym", label: "Cerrar/reabrir Vida y Ministerio", grupo: "Cierre de programas" },
  { id: "cierre_reunion_publica", label: "Cerrar/reabrir Reunión Pública", grupo: "Cierre de programas" },
  { id: "cierre_asignaciones_servicio", label: "Cerrar/reabrir Asignaciones de Servicio", grupo: "Cierre de programas" },
  { id: "cierre_predicacion", label: "Cerrar/reabrir Predicación", grupo: "Cierre de programas" },
];

export const ACCIONES: { id: AccionPermiso; label: string }[] = [
  { id: "ver", label: "Ver" },
  { id: "crear", label: "Crear" },
  { id: "editar", label: "Editar" },
  { id: "eliminar", label: "Eliminar" },
];

// Módulos donde solo la columna "Ver" es relevante (las demás se deshabilitan en el modal).
// Pensados para permisos binarios tipo "puede ejecutar esta acción especial".
export const MODULOS_SOLO_VER: Set<ModuloPermiso> = new Set([
  "cierre_vym",
  "cierre_reunion_publica",
  "cierre_asignaciones_servicio",
  "cierre_predicacion",
]);

export interface PermisoFila {
  modulo: ModuloPermiso;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
}

// =====================================================================
// PRESETS de permisos granulares
// Reemplazan a los roles legacy. Cada preset es un "paquete" de permisos
// granulares que se aplica al usuario en `permisos_usuario_congregacion`.
// El admin puede luego refinar permisos individualmente en el modal.
// =====================================================================

export interface PresetPermiso {
  id: string;
  label: string;
  descripcion: string;
  /** Si true, equivale a marcar todos los módulos con acceso total. */
  acceso_total?: boolean;
  /** Permisos explícitos por módulo. Si no se define, queda sin permiso. */
  permisos?: Partial<Record<ModuloPermiso, { ver: boolean; crear: boolean; editar: boolean; eliminar: boolean }>>;
}

const FULL = { ver: true, crear: true, editar: true, eliminar: true };
const VIEW = { ver: true, crear: false, editar: false, eliminar: false };
const EDIT_NO_DEL = { ver: true, crear: true, editar: true, eliminar: false };

function buildAll(value: { ver: boolean; crear: boolean; editar: boolean; eliminar: boolean }) {
  const out: Partial<Record<ModuloPermiso, typeof value>> = {};
  for (const m of MODULOS) {
    if (MODULOS_SOLO_VER.has(m.id)) {
      out[m.id] = { ver: value.ver, crear: false, editar: false, eliminar: false };
    } else {
      out[m.id] = value;
    }
  }
  return out;
}

export const PRESETS_PERMISOS: PresetPermiso[] = [
  {
    id: "admin_total",
    label: "Administrador (acceso total)",
    descripcion: "Acceso total a todos los módulos.",
    acceso_total: true,
  },
  {
    id: "editor",
    label: "Editor (crear y editar)",
    descripcion: "Puede ver, crear y editar todo. No puede eliminar ni cerrar/reabrir programas.",
    permisos: buildAll(EDIT_NO_DEL),
  },
  {
    id: "solo_lectura",
    label: "Solo lectura",
    descripcion: "Acceso de solo lectura a todos los módulos.",
    permisos: buildAll(VIEW),
  },
  {
    id: "predicacion",
    label: "Encargado de Predicación",
    descripcion: "Acceso total al módulo de Predicación, sus ajustes y configuración relacionada.",
    permisos: {
      inicio: VIEW,
      programas_del_mes: VIEW,
      predicacion_programa: FULL,
      predicacion_capitanes: FULL,
      predicacion_puntos: FULL,
      predicacion_carritos: FULL,
      predicacion_territorios: FULL,
      predicacion_territorios_historial: FULL,
      predicacion_historial: FULL,
      ajustes_predicacion: FULL,
      ajustes_carritos: FULL,
      cierre_predicacion: VIEW,
      configuracion_participantes: FULL,
      configuracion_grupos: FULL,
      configuracion_dias_especiales: FULL,
    },
  },
  {
    id: "reunion_publica",
    label: "Encargado de Reunión Pública",
    descripcion: "Acceso total al módulo de Reunión Pública y sus ajustes.",
    permisos: {
      inicio: VIEW,
      programas_del_mes: VIEW,
      reunion_publica_programa: FULL,
      reunion_publica_lectores: FULL,
      ajustes_reunion_publica: FULL,
      cierre_reunion_publica: VIEW,
      configuracion_participantes: VIEW,
    },
  },
  {
    id: "vida_ministerio",
    label: "Encargado de Vida y Ministerio",
    descripcion: "Acceso total al módulo de Vida y Ministerio y sus ajustes.",
    permisos: {
      inicio: VIEW,
      programas_del_mes: VIEW,
      vym_programa: FULL,
      vym_lectores_ebc: FULL,
      vym_historial: FULL,
      ajustes_vida_ministerio: FULL,
      cierre_vym: VIEW,
      configuracion_participantes: VIEW,
    },
  },
  {
    id: "asignaciones_servicio",
    label: "Encargado de Asignaciones de Servicio",
    descripcion: "Acceso total al módulo de Asignaciones de Servicio.",
    permisos: {
      inicio: VIEW,
      programas_del_mes: VIEW,
      asignaciones_servicio: FULL,
      ajustes_asignaciones: FULL,
      cierre_asignaciones_servicio: VIEW,
      configuracion_participantes: VIEW,
    },
  },
  {
    id: "personalizado",
    label: "Personalizado (sin permisos)",
    descripcion: "Aprueba sin permisos. El administrador los configurará manualmente luego.",
    permisos: {},
  },
];

export function buildPresetRows(presetId: string): PermisoFila[] {
  const preset = PRESETS_PERMISOS.find((p) => p.id === presetId);
  if (!preset) return [];
  const permisos = preset.acceso_total ? buildAll(FULL) : preset.permisos ?? {};
  const rows: PermisoFila[] = [];
  for (const m of MODULOS) {
    const p = permisos[m.id];
    if (!p) continue;
    if (!p.ver && !p.crear && !p.editar && !p.eliminar) continue;
    rows.push({
      modulo: m.id,
      puede_ver: p.ver,
      puede_crear: p.crear,
      puede_editar: p.editar,
      puede_eliminar: p.eliminar,
    });
  }
  return rows;
}

