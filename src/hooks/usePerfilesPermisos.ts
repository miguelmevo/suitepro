import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ModuloPermiso, AccionPermiso } from "@/lib/permisos";

export interface PerfilPermiso {
  id: string;
  congregacion_id: string;
  nombre: string;
  descripcion: string | null;
  icono: string;
  permisos: Partial<Record<ModuloPermiso, Partial<Record<AccionPermiso, boolean>>>>;
  created_at: string;
  updated_at: string;
}

export type PerfilPermisoInput = Pick<PerfilPermiso, "nombre" | "descripcion" | "icono" | "permisos">;

const TABLE = "perfiles_permisos" as const;

export function usePerfilesPermisos(congregacionId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["perfiles-permisos", congregacionId];

  const { data: perfiles = [], isLoading } = useQuery({
    queryKey,
    enabled: !!congregacionId,
    queryFn: async (): Promise<PerfilPermiso[]> => {
      const { data, error } = await supabase
        .from(TABLE as any)
        .select("*")
        .eq("congregacion_id", congregacionId!)
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as unknown as PerfilPermiso[];
    },
  });

  const crear = useMutation({
    mutationFn: async (input: PerfilPermisoInput) => {
      const { error } = await supabase
        .from(TABLE as any)
        .insert({ ...input, congregacion_id: congregacionId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, ...input }: PerfilPermisoInput & { id: string }) => {
      const { error } = await supabase
        .from(TABLE as any)
        .update(input)
        .eq("id", id)
        .eq("congregacion_id", congregacionId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE as any)
        .delete()
        .eq("id", id)
        .eq("congregacion_id", congregacionId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { perfiles, isLoading, crear, actualizar, eliminar };
}
