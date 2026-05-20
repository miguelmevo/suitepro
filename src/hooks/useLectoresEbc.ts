import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";

export interface LectorEbcElegible {
  id: string;
  congregacion_id: string;
  participante_id: string;
  activo: boolean;
  created_at: string;
}

export function useLectoresEbc() {
  const queryClient = useQueryClient();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || null;

  const { data: lectoresElegibles, isLoading } = useQuery({
    queryKey: ["lectores-ebc-elegibles", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];
      const { data, error } = await supabase
        .from("lectores_ebc_elegibles")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true);
      if (error) throw error;
      return data as LectorEbcElegible[];
    },
    enabled: !!congregacionId,
  });

  const agregarLectorElegible = useMutation({
    mutationFn: async (participanteId: string) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");
      const { data, error } = await supabase
        .from("lectores_ebc_elegibles")
        .insert({
          congregacion_id: congregacionId,
          participante_id: participanteId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lectores-ebc-elegibles"] });
      toast.success("Lector agregado");
    },
    onError: (error: Error) => {
      console.error("Error al agregar lector EBC:", error);
      toast.error(error.message || "Error al agregar lector");
    },
  });

  const eliminarLectorElegible = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lectores_ebc_elegibles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lectores-ebc-elegibles"] });
      toast.success("Lector eliminado");
    },
    onError: (error) => {
      console.error("Error al eliminar lector EBC:", error);
      toast.error("Error al eliminar lector");
    },
  });

  return {
    lectoresElegibles,
    isLoading,
    agregarLectorElegible,
    eliminarLectorElegible,
  };
}
