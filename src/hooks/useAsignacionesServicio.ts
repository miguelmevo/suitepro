import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";

export type TipoAsignacionServicio =
  | "audio"
  | "video"
  | "zoom"
  | "plataforma"
  | "pasillo_1"
  | "pasillo_2"
  | "acomodador_auditorio"
  | "acomodador_entrada_1"
  | "acomodador_entrada_2"
  | "aseo_1"
  | "aseo_2"
  | "hospitalidad";

export const TIPOS_ASIGNACION_SERVICIO: { value: TipoAsignacionServicio; label: string; tipoCampo: "individual" | "grupo"; soloFinSemana?: boolean; respParticipante?: string; soloAncianos?: boolean }[] = [
  { value: "audio", label: "Audio", tipoCampo: "individual", respParticipante: "audio" },
  { value: "video", label: "Video", tipoCampo: "individual", respParticipante: "video" },
  { value: "zoom", label: "Zoom", tipoCampo: "individual", respParticipante: "zoom" },
  { value: "plataforma", label: "Plataforma", tipoCampo: "individual", respParticipante: "plataforma" },
  { value: "pasillo_1", label: "Mic. Pasillo #1", tipoCampo: "individual", respParticipante: "microfono_pasillo_1" },
  { value: "pasillo_2", label: "Mic. Pasillo #2", tipoCampo: "individual", respParticipante: "microfono_pasillo_2" },
  { value: "acomodador_auditorio", label: "Auditorio", tipoCampo: "individual", respParticipante: "acomodador_auditorio", soloAncianos: true },
  { value: "acomodador_entrada_1", label: "Entrada #1", tipoCampo: "individual", respParticipante: "acomodador_entrada_1" },
  { value: "acomodador_entrada_2", label: "Entrada #2", tipoCampo: "individual", respParticipante: "acomodador_entrada_2" },
  { value: "aseo_1", label: "Aseo #1", tipoCampo: "grupo" },
  { value: "aseo_2", label: "Aseo #2", tipoCampo: "grupo" },
  { value: "hospitalidad", label: "Hospitalidad", tipoCampo: "grupo", soloFinSemana: true },
];

export interface AsignacionServicio {
  id: string;
  congregacion_id: string;
  fecha: string;
  dia_reunion: "entre_semana" | "fin_semana";
  tipo_asignacion: TipoAsignacionServicio;
  participante_id: string | null;
  grupo_predicacion_id: string | null;
  notas: string | null;
}

const DIAS_MAP: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

export function getMeetingDatesForMonth(
  year: number,
  monthIndex: number,
  diaEntreSemana: string,
  diaFinSemana: string
): { fecha: string; dia_reunion: "entre_semana" | "fin_semana" }[] {
  const start = startOfMonth(new Date(year, monthIndex, 1));
  const end = endOfMonth(start);
  const dEs = DIAS_MAP[diaEntreSemana] ?? 2;
  const dFs = DIAS_MAP[diaFinSemana] ?? 0;
  return eachDayOfInterval({ start, end })
    .filter((d) => d.getDay() === dEs || d.getDay() === dFs)
    .map((d) => ({
      fecha: format(d, "yyyy-MM-dd"),
      dia_reunion: d.getDay() === dFs ? ("fin_semana" as const) : ("entre_semana" as const),
    }));
}

export function useAsignacionesServicio(year?: number, monthIndex?: number) {
  const queryClient = useQueryClient();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || null;

  const fechaInicio = year !== undefined && monthIndex !== undefined ? format(startOfMonth(new Date(year, monthIndex, 1)), "yyyy-MM-dd") : null;
  const fechaFin = year !== undefined && monthIndex !== undefined ? format(endOfMonth(new Date(year, monthIndex, 1)), "yyyy-MM-dd") : null;

  const { data: asignaciones = [], isLoading } = useQuery({
    queryKey: ["asignaciones-servicio", congregacionId, fechaInicio, fechaFin],
    queryFn: async () => {
      if (!congregacionId || !fechaInicio || !fechaFin) return [];
      const { data, error } = await supabase
        .from("programa_asignaciones_servicio")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);
      if (error) throw error;
      return (data ?? []) as AsignacionServicio[];
    },
    enabled: !!congregacionId && !!fechaInicio,
  });

  const upsert = useMutation({
    mutationFn: async (input: {
      fecha: string;
      dia_reunion: "entre_semana" | "fin_semana";
      tipo_asignacion: TipoAsignacionServicio;
      participante_id?: string | null;
      grupo_predicacion_id?: string | null;
    }) => {
      if (!congregacionId) throw new Error("Sin congregación");
      const { data, error } = await supabase
        .from("programa_asignaciones_servicio")
        .upsert(
          {
            congregacion_id: congregacionId,
            fecha: input.fecha,
            dia_reunion: input.dia_reunion,
            tipo_asignacion: input.tipo_asignacion,
            participante_id: input.participante_id ?? null,
            grupo_predicacion_id: input.grupo_predicacion_id ?? null,
          },
          { onConflict: "congregacion_id,fecha,tipo_asignacion" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asignaciones-servicio"] });
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("programa_asignaciones_servicio").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asignaciones-servicio"] }),
  });

  const limpiarMes = useMutation({
    mutationFn: async () => {
      if (!congregacionId || !fechaInicio || !fechaFin) throw new Error("Sin rango");
      const { error } = await supabase
        .from("programa_asignaciones_servicio")
        .delete()
        .eq("congregacion_id", congregacionId)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asignaciones-servicio"] }),
    onError: (e: any) => toast.error(e.message || "Error al limpiar"),
  });

  return { asignaciones, isLoading, upsert, eliminar, limpiarMes };
}
