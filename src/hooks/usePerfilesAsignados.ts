import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PerfilAsignado {
  perfil_id: string;
  nombre: string;
  color: string | null;
  app_role: string | null;
}

const TABLE = "usuario_perfiles_asignados" as const;

/** Perfiles asignados a un usuario específico en una congregación */
export function usePerfilesAsignados(userId: string | null, congregacionId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["perfiles-asignados", userId, congregacionId];

  const { data: perfilesAsignados = [], isLoading } = useQuery({
    queryKey,
    enabled: !!userId && !!congregacionId,
    queryFn: async (): Promise<PerfilAsignado[]> => {
      const { data, error } = await supabase
        .from(TABLE as any)
        .select("perfil_id, perfil:perfil_id(nombre, color, app_role)")
        .eq("user_id", userId!)
        .eq("congregacion_id", congregacionId!);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        perfil_id: row.perfil_id,
        nombre: row.perfil?.nombre ?? "",
        color: row.perfil?.color ?? null,
        app_role: row.perfil?.app_role ?? null,
      }));
    },
  });

  const guardar = useMutation({
    mutationFn: async (perfilIds: string[]) => {
      if (!userId || !congregacionId) throw new Error("Datos incompletos");

      // Reemplaza todas las asignaciones
      const { error: delError } = await supabase
        .from(TABLE as any)
        .delete()
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);
      if (delError) throw delError;

      if (perfilIds.length > 0) {
        const rows = perfilIds.map((perfil_id) => ({
          user_id: userId,
          congregacion_id: congregacionId,
          perfil_id,
        }));
        const { error: insError } = await supabase.from(TABLE as any).insert(rows as any);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["perfiles-asignados-congregacion", congregacionId] });
    },
  });

  return { perfilesAsignados, isLoading, guardar };
}

/** Todos los perfiles asignados en una congregación (para la lista de usuarios) */
export function usePerfilesAsignadosCongregacion(congregacionId: string | null) {
  return useQuery({
    queryKey: ["perfiles-asignados-congregacion", congregacionId],
    enabled: !!congregacionId,
    queryFn: async (): Promise<Map<string, PerfilAsignado[]>> => {
      const { data, error } = await supabase
        .from(TABLE as any)
        .select("user_id, perfil_id, perfil:perfil_id(nombre, color, app_role)")
        .eq("congregacion_id", congregacionId!);
      if (error) throw error;

      const map = new Map<string, PerfilAsignado[]>();
      for (const row of data ?? []) {
        const r = row as any;
        const uid = r.user_id as string;
        if (!map.has(uid)) map.set(uid, []);
        map.get(uid)!.push({
          perfil_id: r.perfil_id,
          nombre: r.perfil?.nombre ?? "",
          color: r.perfil?.color ?? null,
          app_role: r.perfil?.app_role ?? null,
        });
      }
      return map;
    },
  });
}
