import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface AsigServDiaEspecial {
  id: string;
  congregacion_id: string;
  fecha: string;
  mensaje: string;
  color: string;
}

export function useAsignacionesServicioDiasEspeciales(year?: number, monthIndex?: number) {
  const queryClient = useQueryClient();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || null;

  const fechaInicio =
    year !== undefined && monthIndex !== undefined
      ? format(startOfMonth(new Date(year, monthIndex, 1)), "yyyy-MM-dd")
      : null;
  const fechaFin =
    year !== undefined && monthIndex !== undefined
      ? format(endOfMonth(new Date(year, monthIndex, 1)), "yyyy-MM-dd")
      : null;

  const { data: diasEspecialesAsignados = [], isLoading } = useQuery({
    queryKey: ["asig-serv-dias-especiales", congregacionId, fechaInicio, fechaFin],
    queryFn: async () => {
      if (!congregacionId || !fechaInicio || !fechaFin) return [];
      const { data, error } = await supabase
        .from("asignaciones_servicio_dias_especiales")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);
      if (error) throw error;
      return (data ?? []) as AsigServDiaEspecial[];
    },
    enabled: !!congregacionId && !!fechaInicio,
  });

  const setDiaEspecial = useMutation({
    mutationFn: async (input: { fecha: string; mensaje: string; color: string }) => {
      if (!congregacionId) throw new Error("Sin congregación");
      const { data, error } = await supabase
        .from("asignaciones_servicio_dias_especiales")
        .upsert(
          {
            congregacion_id: congregacionId,
            fecha: input.fecha,
            mensaje: input.mensaje,
            color: input.color,
          },
          { onConflict: "congregacion_id,fecha" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asig-serv-dias-especiales"] }),
    onError: (e: any) => toast.error(e.message || "Error al marcar día especial"),
  });

  const removeDiaEspecial = useMutation({
    mutationFn: async (fecha: string) => {
      if (!congregacionId) throw new Error("Sin congregación");
      const { error } = await supabase
        .from("asignaciones_servicio_dias_especiales")
        .delete()
        .eq("congregacion_id", congregacionId)
        .eq("fecha", fecha);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asig-serv-dias-especiales"] }),
    onError: (e: any) => toast.error(e.message || "Error al quitar día especial"),
  });

  return { diasEspecialesAsignados, isLoading, setDiaEspecial, removeDiaEspecial };
}
