import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ModuloPermiso, AccionPermiso } from "@/lib/permisos";

export interface PerfilPermiso {
  id: string;
  congregacion_id: string | null;
  nombre: string;
  descripcion: string | null;
  icono: string;
  permisos: Partial<Record<ModuloPermiso, Partial<Record<AccionPermiso, boolean>>>>;
  es_sistema: boolean;
  app_role: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export type PerfilPermisoInput = Pick<PerfilPermiso, "nombre" | "descripcion" | "icono" | "permisos">;

const TABLE = "perfiles_permisos" as const;

export function usePerfilesPermisos(congregacionId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["perfiles-permisos", congregacionId];

  const { data: todosPerfiles = [], isLoading } = useQuery({
    queryKey,
    enabled: !!congregacionId,
    queryFn: async (): Promise<PerfilPermiso[]> => {
      const { data, error } = await supabase
        .from(TABLE as any)
        .select("*")
        .or(`es_sistema.eq.true,congregacion_id.eq.${congregacionId}`)
        .order("es_sistema", { ascending: false })
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as unknown as PerfilPermiso[];
    },
  });

  // Perfiles del sistema (predefinidos, sin congregación)
  const perfilesSistema = todosPerfiles.filter((p) => p.es_sistema);
  // Perfiles personalizados de la congregación
  const perfiles = todosPerfiles.filter((p) => !p.es_sistema);

  const crear = useMutation({
    mutationFn: async (input: PerfilPermisoInput) => {
      const { error } = await supabase
        .from(TABLE as any)
        .insert({ ...input, congregacion_id: congregacionId, es_sistema: false });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, ...input }: Partial<PerfilPermisoInput> & { id: string }) => {
      const { error } = await supabase
        .from(TABLE as any)
        .update(input)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { perfiles, perfilesSistema, todosPerfiles, isLoading, crear, actualizar, eliminar };
}
