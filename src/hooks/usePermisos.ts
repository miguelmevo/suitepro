import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { AccionPermiso, ModuloPermiso, PermisoFila } from "@/lib/permisos";

/**
 * Hook unificado de permisos.
 */
export function usePermisos() {
  const { user } = useAuthContext();
  const { congregacionActual, isLoading: congregacionLoading } = useCongregacion();
  const congregacionId = congregacionActual?.id ?? null;
  const enabled = !!user && !!congregacionId;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["mis-permisos", user?.id, congregacionId],
    enabled,
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

  // Evitar redirects prematuros: si todavía no tenemos la congregación o
  // los permisos no han llegado, mantenemos `loading=true`.
  const loading =
    (!!user && congregacionLoading) ||
    (!!user && !congregacionId) ||
    isLoading ||
    isFetching ||
    (enabled && data === undefined);

  return {
    loading,
    can,
    canView: (m: ModuloPermiso) => can(m, "ver"),
    canCreate: (m: ModuloPermiso) => can(m, "crear"),
    canEdit: (m: ModuloPermiso) => can(m, "editar"),
    canDelete: (m: ModuloPermiso) => can(m, "eliminar"),
  };
}
