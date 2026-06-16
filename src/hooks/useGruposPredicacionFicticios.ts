import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";

export interface GrupoPredicacionFicticio {
  id: string;
  congregacion_id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  habilitado_en_formulario: boolean;
  created_at: string;
  updated_at: string;
}

export function useGruposPredicacionFicticios() {
  const queryClient = useQueryClient();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || null;

  const { data: gruposFicticios, isLoading } = useQuery({
    queryKey: ["grupos-predicacion-ficticios", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [] as GrupoPredicacionFicticio[];
      const { data, error } = await (supabase as any)
        .from("grupos_predicacion_ficticios")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as GrupoPredicacionFicticio[];
    },
    enabled: !!congregacionId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["grupos-predicacion-ficticios", congregacionId] });

  const crear = useMutation({
    mutationFn: async (input: { nombre: string }) => {
      if (!congregacionId) throw new Error("Sin congregación");
      const orden = (gruposFicticios?.length || 0) + 1;
      const { error } = await (supabase as any)
        .from("grupos_predicacion_ficticios")
        .insert({ congregacion_id: congregacionId, nombre: input.nombre.trim(), orden });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Grupo ficticio agregado"); },
    onError: (e: any) => toast.error(e.message || "Error al agregar"),
  });

  const actualizar = useMutation({
    mutationFn: async (input: Partial<GrupoPredicacionFicticio> & { id: string }) => {
      const { id, ...rest } = input;
      const { error } = await (supabase as any)
        .from("grupos_predicacion_ficticios")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message || "Error al actualizar"),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("grupos_predicacion_ficticios")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Grupo ficticio eliminado"); },
    onError: (e: any) => toast.error(e.message || "Error al eliminar"),
  });

  return {
    gruposFicticios: gruposFicticios || [],
    gruposFicticiosActivos: (gruposFicticios || []).filter((g) => g.activo && g.habilitado_en_formulario),
    isLoading,
    crear,
    actualizar,
    eliminar,
  };
}
