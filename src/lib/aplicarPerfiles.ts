import { supabase } from "@/integrations/supabase/client";
import { MODULOS, type AccionPermiso, type ModuloPermiso, type PermisoFila } from "@/lib/permisos";
import type { PerfilPermiso } from "@/hooks/usePerfilesPermisos";

// Igual que en PermisosModal: el perfil de sistema de mayor prioridad define el
// rol principal (usuarios_congregacion.rol) de quien tiene varios.
const ROLE_PRIORITY = ["admin", "editor", "viewer", "sservicio", "srpublica", "svministerio", "saservicio", "user"];

const ACCIONES: AccionPermiso[] = ["ver", "crear", "editar", "eliminar"];

/** Une los permisos de varios perfiles (un permiso vale si lo da alguno). */
export function filasDesdePerfiles(perfiles: PerfilPermiso[]): PermisoFila[] {
  const total: Record<string, Record<AccionPermiso, boolean>> = {};
  for (const perfil of perfiles) {
    for (const [modulo, acciones] of Object.entries(perfil.permisos ?? {})) {
      const actual = (total[modulo] ??= { ver: false, crear: false, editar: false, eliminar: false });
      for (const a of ACCIONES) actual[a] = actual[a] || !!acciones?.[a];
    }
  }
  return MODULOS.filter((m) => total[m.id] && ACCIONES.some((a) => total[m.id][a])).map((m) => ({
    modulo: m.id as ModuloPermiso,
    puede_ver: total[m.id].ver,
    puede_crear: total[m.id].crear,
    puede_editar: total[m.id].editar,
    puede_eliminar: total[m.id].eliminar,
  }));
}

export function rolDesdePerfiles(perfiles: PerfilPermiso[]): string {
  for (const rol of ROLE_PRIORITY) {
    if (perfiles.some((p) => p.app_role === rol)) return rol;
  }
  return "user";
}

/**
 * Perfiles con los que cuenta hoy un usuario: los asignados, más el perfil de
 * sistema que corresponde a su rol principal (un administrador antiguo puede
 * no tener la asignación guardada, pero su rol equivale a "Administrador").
 */
export function perfilesActualesDeUsuario(
  asignadosIds: string[],
  rolActual: string | null | undefined,
  perfilesDisponibles: PerfilPermiso[],
): Set<string> {
  const ids = new Set(asignadosIds);
  if (rolActual && rolActual !== "user") {
    const deSistema = perfilesDisponibles.find((p) => p.es_sistema && p.app_role === rolActual);
    if (deSistema) ids.add(deSistema.id);
  }
  return ids;
}

/**
 * Deja al usuario con exactamente estos perfiles: recalcula sus permisos desde
 * cero (como al marcar/desmarcar perfiles en el modal de roles), actualiza su
 * rol principal y reemplaza sus asignaciones. Los permisos sueltos que tuviera
 * fuera de sus perfiles se pierden, igual que en el modal.
 */
export async function aplicarPerfilesAUsuario(params: {
  userId: string;
  congregacionId: string;
  perfilIds: string[];
  perfilesDisponibles: PerfilPermiso[];
}) {
  const { userId, congregacionId, perfilIds, perfilesDisponibles } = params;
  const elegidos = perfilesDisponibles.filter((p) => perfilIds.includes(p.id));

  const { error: rolError } = await supabase
    .from("usuarios_congregacion")
    .update({ rol: rolDesdePerfiles(elegidos) as any })
    .eq("user_id", userId)
    .eq("congregacion_id", congregacionId);
  if (rolError) throw rolError;

  const { error: permisosError } = await (supabase.rpc as any)("guardar_permisos_usuario", {
    _target_user_id: userId,
    _congregacion_id: congregacionId,
    _rows: filasDesdePerfiles(elegidos),
  });
  if (permisosError) throw permisosError;

  const { error: delError } = await supabase
    .from("usuario_perfiles_asignados" as any)
    .delete()
    .eq("user_id", userId)
    .eq("congregacion_id", congregacionId);
  if (delError) throw delError;

  if (perfilIds.length > 0) {
    const { error: insError } = await supabase
      .from("usuario_perfiles_asignados" as any)
      .insert(perfilIds.map((perfil_id) => ({ user_id: userId, congregacion_id: congregacionId, perfil_id })) as any);
    if (insError) throw insError;
  }
}

/**
 * Cambia solo el permiso de UN módulo de un usuario (acciones = null lo quita),
 * conservando el resto de sus permisos. Es un ajuste individual: no toca sus
 * perfiles asignados.
 */
export async function guardarPermisoDeModulo(params: {
  userId: string;
  congregacionId: string;
  modulo: ModuloPermiso;
  acciones: AccionPermiso[] | null;
}) {
  const { userId, congregacionId, modulo, acciones } = params;

  const { data, error } = await supabase
    .from("permisos_usuario_congregacion" as any)
    .select("modulo, puede_ver, puede_crear, puede_editar, puede_eliminar")
    .eq("user_id", userId)
    .eq("congregacion_id", congregacionId);
  if (error) throw error;

  const otras = ((data ?? []) as unknown as PermisoFila[]).filter((f) => f.modulo !== modulo);
  const nueva: PermisoFila[] =
    acciones && acciones.length > 0
      ? [{
          modulo,
          puede_ver: acciones.includes("ver"),
          puede_crear: acciones.includes("crear"),
          puede_editar: acciones.includes("editar"),
          puede_eliminar: acciones.includes("eliminar"),
        }]
      : [];

  const { error: rpcError } = await (supabase.rpc as any)("guardar_permisos_usuario", {
    _target_user_id: userId,
    _congregacion_id: congregacionId,
    _rows: [...otras, ...nueva],
  });
  if (rpcError) throw rpcError;
}
