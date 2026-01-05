import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GrupoServicio, GrupoConMiembros, MiembroGrupo } from "@/types/grupos-servicio";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";

export function useGruposServicio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const congregacionId = useCongregacionId();

  const gruposQuery = useQuery({
    queryKey: ["grupos-servicio", congregacionId],
    queryFn: async (): Promise<GrupoConMiembros[]> => {
      const { data: grupos, error: gruposError } = await supabase
        .from("grupos_servicio")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .order("nombre");

      if (gruposError) throw gruposError;

      const { data: miembros, error: miembrosError } = await supabase
        .from("miembros_grupo")
        .select(`
          *,
          participante:participantes(*)
        `)
        .eq("activo", true)
        .eq("congregacion_id", congregacionId);

      if (miembrosError) throw miembrosError;

      return grupos.map((grupo) => ({
        ...grupo,
        miembros: miembros.filter((m) => m.grupo_id === grupo.id) as MiembroGrupo[],
      }));
    },
    enabled: !!congregacionId,
  });

  const crearGrupo = useMutation({
    mutationFn: async (data: { nombre: string; descripcion?: string }) => {
      const { data: grupo, error } = await supabase
        .from("grupos_servicio")
        .insert({
          ...data,
          congregacion_id: congregacionId,
        })
        .select()
        .single();

      if (error) throw error;
      return grupo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-servicio"] });
      toast({ title: "Grupo creado exitosamente" });
    },
    onError: (error) => {
      toast({ title: "Error al crear grupo", description: error.message, variant: "destructive" });
    },
  });

  const actualizarGrupo = useMutation({
    mutationFn: async ({ id, ...data }: Partial<GrupoServicio> & { id: string }) => {
      const { error } = await supabase
        .from("grupos_servicio")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-servicio"] });
      toast({ title: "Grupo actualizado" });
    },
    onError: (error) => {
      toast({ title: "Error al actualizar grupo", description: error.message, variant: "destructive" });
    },
  });

  const eliminarGrupo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("grupos_servicio")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-servicio"] });
      toast({ title: "Grupo eliminado" });
    },
    onError: (error) => {
      toast({ title: "Error al eliminar grupo", description: error.message, variant: "destructive" });
    },
  });

  const agregarMiembro = useMutation({
    mutationFn: async (data: { participante_id: string; grupo_id: string; es_capitan?: boolean }) => {
      const { error } = await supabase
        .from("miembros_grupo")
        .upsert(
          { ...data, activo: true, congregacion_id: congregacionId },
          { onConflict: "participante_id,grupo_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-servicio"] });
      toast({ title: "Miembro agregado" });
    },
    onError: (error) => {
      toast({ title: "Error al agregar miembro", description: error.message, variant: "destructive" });
    },
  });

  const removerMiembro = useMutation({
    mutationFn: async ({ participante_id, grupo_id }: { participante_id: string; grupo_id: string }) => {
      const { error } = await supabase
        .from("miembros_grupo")
        .delete()
        .eq("participante_id", participante_id)
        .eq("grupo_id", grupo_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-servicio"] });
      toast({ title: "Miembro removido" });
    },
    onError: (error) => {
      toast({ title: "Error al remover miembro", description: error.message, variant: "destructive" });
    },
  });

  const toggleCapitan = useMutation({
    mutationFn: async ({ participante_id, grupo_id, es_capitan }: { participante_id: string; grupo_id: string; es_capitan: boolean }) => {
      const { error } = await supabase
        .from("miembros_grupo")
        .update({ es_capitan })
        .eq("participante_id", participante_id)
        .eq("grupo_id", grupo_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-servicio"] });
    },
    onError: (error) => {
      toast({ title: "Error al actualizar capitán", description: error.message, variant: "destructive" });
    },
  });

  return {
    grupos: gruposQuery.data ?? [],
    isLoading: gruposQuery.isLoading,
    error: gruposQuery.error,
    crearGrupo,
    actualizarGrupo,
    eliminarGrupo,
    agregarMiembro,
    removerMiembro,
    toggleCapitan,
  };
}
