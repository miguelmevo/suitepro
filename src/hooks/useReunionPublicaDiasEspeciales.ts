import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface RPDiaEspecial {
  id: string;
  congregacion_id: string;
  fecha: string;
  mensaje: string;
  color: string;
  /** Color de fondo usado SOLO en el PDF (la pantalla siempre usa "color"). */
  color_pdf: string | null;
  /** 1 = fila Presidente, 2 = fila Orador. Permite hasta 2 días especiales por fecha. */
  slot: 1 | 2;
}

export function useReunionPublicaDiasEspeciales(year?: number, monthIndex?: number) {
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
    queryKey: ["rp-dias-especiales", congregacionId, fechaInicio, fechaFin],
    queryFn: async () => {
      if (!congregacionId || !fechaInicio || !fechaFin) return [];
      const { data, error } = await supabase
        .from("reunion_publica_dias_especiales")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
        .order("slot");
      if (error) throw error;
      return (data ?? []) as RPDiaEspecial[];
    },
    enabled: !!congregacionId && !!fechaInicio,
  });

  const setDiaEspecial = useMutation({
    mutationFn: async (input: { fecha: string; slot: 1 | 2; mensaje: string; color: string; color_pdf?: string | null }) => {
      if (!congregacionId) throw new Error("Sin congregación");
      const { data, error } = await supabase
        .from("reunion_publica_dias_especiales")
        .upsert(
          {
            congregacion_id: congregacionId,
            fecha: input.fecha,
            slot: input.slot,
            mensaje: input.mensaje,
            color: input.color,
            color_pdf: input.color_pdf ?? null,
          },
          { onConflict: "congregacion_id,fecha,slot" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rp-dias-especiales"] }),
    onError: (e: any) => toast.error(e.message || "Error al marcar día especial"),
  });

  const removeDiaEspecial = useMutation({
    mutationFn: async (input: { fecha: string; slot: 1 | 2 }) => {
      if (!congregacionId) throw new Error("Sin congregación");
      const { error } = await supabase
        .from("reunion_publica_dias_especiales")
        .delete()
        .eq("congregacion_id", congregacionId)
        .eq("fecha", input.fecha)
        .eq("slot", input.slot);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rp-dias-especiales"] }),
    onError: (e: any) => toast.error(e.message || "Error al quitar día especial"),
  });

  return { diasEspecialesAsignados, isLoading, setDiaEspecial, removeDiaEspecial };
}
