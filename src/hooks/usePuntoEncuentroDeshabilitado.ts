import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";

export interface PuntoEncuentroDeshabilitado {
  id: string;
  punto_encuentro_id: string;
  congregacion_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo: string | null;
  created_at: string;
}

export function usePuntoEncuentroDeshabilitado(puntoEncuentroId?: string) {
  const { toast } = useToast();
  const congregacionId = useCongregacionId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["puntos-encuentro-deshabilitados", puntoEncuentroId ?? congregacionId],
    queryFn: async () => {
      let queryBuilder = supabase
        .from("puntos_encuentro_deshabilitados")
        .select("*")
        .order("fecha_inicio", { ascending: true });

      queryBuilder = puntoEncuentroId
        ? queryBuilder.eq("punto_encuentro_id", puntoEncuentroId)
        : queryBuilder.eq("congregacion_id", congregacionId as string);

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data as PuntoEncuentroDeshabilitado[];
    },
    enabled: !!puntoEncuentroId || !!congregacionId,
  });

  const crear = useMutation({
    mutationFn: async (data: { punto_encuentro_id: string; fecha_inicio: string; fecha_fin?: string | null; motivo?: string }) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");
      const { error } = await supabase.from("puntos_encuentro_deshabilitados").insert({
        punto_encuentro_id: data.punto_encuentro_id,
        congregacion_id: congregacionId,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin || null,
        motivo: data.motivo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["puntos-encuentro-deshabilitados"] });
      toast({ title: "Fecha deshabilitada", description: "El punto de encuentro no se ofrecerá en esas fechas." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo guardar.", variant: "destructive" });
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("puntos_encuentro_deshabilitados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["puntos-encuentro-deshabilitados"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo eliminar.", variant: "destructive" });
    },
  });

  return {
    deshabilitadas: query.data ?? [],
    isLoading: query.isLoading,
    crear,
    eliminar,
  };
}
