import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";

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
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id;

  const { data: grupos, isLoading } = useQuery({
    queryKey: ["grupos-predicacion", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];
      
      const { data, error } = await supabase
        .from("grupos_predicacion")
        .select(`
          *,
          superintendente:participantes!grupos_predicacion_superintendente_id_fkey(id, nombre, apellido),
          auxiliar:participantes!grupos_predicacion_auxiliar_id_fkey(id, nombre, apellido)
        `)
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .order("numero", { ascending: true });

      if (error) throw error;
      return data as GrupoPredicacion[];
    },
    enabled: !!congregacionId,
  });

  const sincronizarGrupos = useMutation({
    mutationFn: async (cantidadGrupos: number) => {
      if (!congregacionId) {
        throw new Error("No hay congregación seleccionada");
      }

      // Obtener TODOS los grupos (activos e inactivos) de esta congregación
      const { data: existentes, error: fetchError } = await supabase
        .from("grupos_predicacion")
        .select("numero, activo")
        .eq("congregacion_id", congregacionId);

      if (fetchError) throw fetchError;

      const gruposMap = new Map(existentes?.map((g) => [g.numero, g.activo]) || []);

      // Crear grupos faltantes (que no existen en absoluto)
      const gruposACrear = [];
      for (let i = 1; i <= cantidadGrupos; i++) {
        if (!gruposMap.has(i)) {
          gruposACrear.push({ numero: i, activo: true, congregacion_id: congregacionId });
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
        .eq("congregacion_id", congregacionId)
        .gt("numero", cantidadGrupos);

      if (updateError) throw updateError;

      // Reactivar grupos dentro del rango
      const { error: reactivateError } = await supabase
        .from("grupos_predicacion")
        .update({ activo: true })
        .eq("congregacion_id", congregacionId)
        .lte("numero", cantidadGrupos);

      if (reactivateError) throw reactivateError;

      return cantidadGrupos;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-predicacion", congregacionId] });
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
