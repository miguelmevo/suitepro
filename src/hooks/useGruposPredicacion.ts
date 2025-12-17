import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GrupoPredicacion {
  id: string;
  numero: number;
  superintendente_id: string | null;
  auxiliar_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  superintendente?: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
  auxiliar?: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
}

export function useGruposPredicacion() {
  const queryClient = useQueryClient();

  const { data: grupos, isLoading } = useQuery({
    queryKey: ["grupos-predicacion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos_predicacion")
        .select(`
          *,
          superintendente:participantes!grupos_predicacion_superintendente_id_fkey(id, nombre, apellido),
          auxiliar:participantes!grupos_predicacion_auxiliar_id_fkey(id, nombre, apellido)
        `)
        .eq("activo", true)
        .order("numero", { ascending: true });

      if (error) throw error;
      return data as GrupoPredicacion[];
    },
  });

  const sincronizarGrupos = useMutation({
    mutationFn: async (cantidadGrupos: number) => {
      // Obtener TODOS los grupos (activos e inactivos)
      const { data: existentes, error: fetchError } = await supabase
        .from("grupos_predicacion")
        .select("numero, activo");

      if (fetchError) throw fetchError;

      const gruposMap = new Map(existentes?.map((g) => [g.numero, g.activo]) || []);

      // Crear grupos faltantes (que no existen en absoluto)
      const gruposACrear = [];
      for (let i = 1; i <= cantidadGrupos; i++) {
        if (!gruposMap.has(i)) {
          gruposACrear.push({ numero: i, activo: true });
        }
      }

      if (gruposACrear.length > 0) {
        const { error: insertError } = await supabase
          .from("grupos_predicacion")
          .insert(gruposACrear);

        if (insertError) throw insertError;
      }

      // Desactivar grupos que excedan el número configurado
      const { error: updateError } = await supabase
        .from("grupos_predicacion")
        .update({ activo: false })
        .gt("numero", cantidadGrupos);

      if (updateError) throw updateError;

      // Reactivar grupos dentro del rango
      const { error: reactivateError } = await supabase
        .from("grupos_predicacion")
        .update({ activo: true })
        .lte("numero", cantidadGrupos);

      if (reactivateError) throw reactivateError;

      return cantidadGrupos;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-predicacion"] });
    },
    onError: (error) => {
      console.error("Error al sincronizar grupos:", error);
      toast.error("Error al sincronizar grupos");
    },
  });

  const actualizarGrupo = useMutation({
    mutationFn: async ({
      grupoId,
      superintendenteId,
      auxiliarId,
    }: {
      grupoId: string;
      superintendenteId: string | null;
      auxiliarId: string | null;
    }) => {
      const { data, error } = await supabase
        .from("grupos_predicacion")
        .update({
          superintendente_id: superintendenteId,
          auxiliar_id: auxiliarId,
        })
        .eq("id", grupoId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-predicacion"] });
      toast.success("Grupo actualizado");
    },
    onError: (error) => {
      console.error("Error al actualizar grupo:", error);
      toast.error("Error al actualizar el grupo");
    },
  });

  return {
    grupos,
    isLoading,
    sincronizarGrupos,
    actualizarGrupo,
  };
}
