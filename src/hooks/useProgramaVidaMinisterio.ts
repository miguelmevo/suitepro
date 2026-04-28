import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";
import type { ProgramaVidaMinisterio } from "@/types/vida-ministerio";

const TABLE = "programa_vida_ministerio" as const;

function mapRow(row: any): ProgramaVidaMinisterio {
  return {
    ...row,
    tesoros: row.tesoros ?? { titulo: "", participante_id: null },
    lectura_biblica: row.lectura_biblica ?? { cita: "", participante_id: null },
    maestros: Array.isArray(row.maestros) ? row.maestros : [],
    vida_cristiana: Array.isArray(row.vida_cristiana) ? row.vida_cristiana : [],
    estudio_biblico: row.estudio_biblico ?? { titulo: "", conductor_id: null, lector_id: null },
  } as ProgramaVidaMinisterio;
}

export function useProgramasVidaMinisterio() {
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || null;

  const query = useQuery({
    queryKey: ["programa-vida-ministerio", "lista", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .order("fecha_semana", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    enabled: !!congregacionId,
  });

  return query;
}

export function useProgramaVidaMinisterioByFecha(fechaSemana: string | null) {
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || null;

  return useQuery({
    queryKey: ["programa-vida-ministerio", "fecha", congregacionId, fechaSemana],
    queryFn: async () => {
      if (!congregacionId || !fechaSemana) return null;
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("fecha_semana", fechaSemana)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data) : null;
    },
    enabled: !!congregacionId && !!fechaSemana,
  });
}

export function useGuardarProgramaVidaMinisterio() {
  const queryClient = useQueryClient();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || null;

  return useMutation({
    mutationFn: async (payload: Partial<ProgramaVidaMinisterio> & { fecha_semana: string }) => {
      if (!congregacionId) throw new Error("Sin congregación");
      const { data, error } = await supabase
        .from(TABLE)
        .upsert(
          [{ ...payload, congregacion_id: congregacionId } as any],
          { onConflict: "congregacion_id,fecha_semana" }
        )
        .select()
        .single();
      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programa-vida-ministerio"] });
      toast.success("Programa guardado");
    },
    onError: (err: Error) => {
      console.error("Error guardando VyM:", err);
      toast.error(err.message || "Error al guardar");
    },
  });
}

export function useEliminarProgramaVidaMinisterio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programa-vida-ministerio"] });
      toast.success("Programa eliminado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al eliminar");
    },
  });
}
