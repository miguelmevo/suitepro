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
  | "configuracion_ajustes"
  | "configuracion_usuarios";

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
  { id: "configuracion_ajustes", label: "Ajustes del sistema", grupo: "Configuración" },
  { id: "configuracion_usuarios", label: "Usuarios y permisos", grupo: "Configuración" },
];

export const ACCIONES: { id: AccionPermiso; label: string }[] = [
  { id: "ver", label: "Ver" },
  { id: "crear", label: "Crear" },
  { id: "editar", label: "Editar" },
  { id: "eliminar", label: "Eliminar" },
];

export interface PermisoFila {
  modulo: ModuloPermiso;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
}
