import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { format, startOfMonth, endOfMonth } from "date-fns";

export type ProgramaAplicable = "reunion_publica" | "asignaciones_servicio";

export interface DiaEspecialFecha {
  id: string;
  congregacion_id: string;
  fecha: string;
  motivo: string;
  color: string;
  bloqueo_tipo: "completo" | "manana" | "tarde";
  programas: ProgramaAplicable[];
}

/** Sin year/monthIndex, trae todas las fechas de la congregación (para la
 * tabla de gestión en Ajustes). Con year/monthIndex, solo las del mes
 * (para aplicar automáticamente en un programa). */
export function useDiasEspecialesFechas(year?: number, monthIndex?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const congregacionId = useCongregacionId();

  const fechaInicio =
    year !== undefined && monthIndex !== undefined
      ? format(startOfMonth(new Date(year, monthIndex, 1)), "yyyy-MM-dd")
      : null;
  const fechaFin =
    year !== undefined && monthIndex !== undefined
      ? format(endOfMonth(new Date(year, monthIndex, 1)), "yyyy-MM-dd")
      : null;

  const { data: fechas = [], isLoading } = useQuery({
    queryKey: ["dias-especiales-fechas", congregacionId, fechaInicio, fechaFin],
    queryFn: async () => {
      let query = supabase
        .from("dias_especiales_fechas")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .order("fecha");
      if (fechaInicio && fechaFin) {
        query = query.gte("fecha", fechaInicio).lte("fecha", fechaFin);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DiaEspecialFecha[];
    },
    enabled: !!congregacionId,
  });

  const crearFecha = useMutation({
    mutationFn: async (input: {
      fecha: string;
      motivo: string;
      color: string;
      bloqueo_tipo: "completo" | "manana" | "tarde";
      programas: ProgramaAplicable[];
    }) => {
      const { error } = await supabase.from("dias_especiales_fechas").insert({
        congregacion_id: congregacionId,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales-fechas"] });
      toast({ title: "Fecha agregada" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Error al agregar la fecha", variant: "destructive" });
    },
  });

  const actualizarFecha = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      fecha?: string;
      motivo?: string;
      color?: string;
      bloqueo_tipo?: "completo" | "manana" | "tarde";
      programas?: ProgramaAplicable[];
    }) => {
      const { error } = await supabase.from("dias_especiales_fechas").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales-fechas"] });
      toast({ title: "Fecha actualizada" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Error al actualizar", variant: "destructive" });
    },
  });

  const eliminarFecha = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dias_especiales_fechas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales-fechas"] });
      toast({ title: "Fecha eliminada" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Error al eliminar", variant: "destructive" });
    },
  });

  return { fechas, isLoading, crearFecha, actualizarFecha, eliminarFecha };
}
