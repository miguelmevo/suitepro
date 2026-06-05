import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { AccionPermiso, ModuloPermiso, PermisoFila } from "@/lib/permisos";

/**
 * Hook unificado de permisos.
 *
 * Combina permisos granulares (tabla `permisos_usuario_congregacion`)
 * con los roles legacy a través de la función `has_permission` en la
 * base de datos. Si todavía no se han asignado permisos a un usuario,
 * los roles tradicionales (admin / editor / viewer / etc.) siguen aplicando.
 */
export function usePermisos() {
  const { user } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["mis-permisos", user?.id, congregacionId],
    enabled: !!user && !!congregacionId,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<ModuloPermiso, PermisoFila>> => {
      const { data, error } = await (supabase.rpc as any)("get_my_permissions", {
        _congregacion_id: congregacionId,
      });
      if (error) throw error;
      const map = new Map<ModuloPermiso, PermisoFila>();
      for (const row of (data ?? []) as PermisoFila[]) {
        map.set(row.modulo, row);
      }
      return map;
    },
  });

  const get = (modulo: ModuloPermiso): PermisoFila | undefined =>
    data?.get(modulo);

  const can = (modulo: ModuloPermiso, accion: AccionPermiso): boolean => {
    const row = get(modulo);
    if (!row) return false;
    switch (accion) {
      case "ver":
        return row.puede_ver;
      case "crear":
        return row.puede_crear;
      case "editar":
        return row.puede_editar;
      case "eliminar":
        return row.puede_eliminar;
    }
  };

  return {
    loading: isLoading,
    can,
    canView: (m: ModuloPermiso) => can(m, "ver"),
    canCreate: (m: ModuloPermiso) => can(m, "crear"),
    canEdit: (m: ModuloPermiso) => can(m, "editar"),
    canDelete: (m: ModuloPermiso) => can(m, "eliminar"),
  };
}
