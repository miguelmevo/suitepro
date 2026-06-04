import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProgramaConDetalles, HorarioSalida, PuntoEncuentro, Territorio, AsignacionGrupo } from "@/types/programa-predicacion";

interface PublicoCompleto {
  programa: ProgramaConDetalles[];
  horarios: HorarioSalida[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  grupos_predicacion: Array<{ id: string; numero: number; activo: boolean }>;
  dias_especiales: Array<{
    id: string;
    nombre: string;
    fecha: string | null;
    color: string;
    bloquea_reuniones: string[];
    bloqueo_tipo: string;
    activo: boolean;
  }>;
  configuracion_general: Array<{
    programa_tipo: string;
    clave: string;
    valor: Record<string, unknown>;
  }>;
  mensajes_adicionales: Array<{
    id: string;
    fecha: string;
    mensaje: string;
    color: string;
    modulo: string;
  }>;
}

/**
 * Hook público (sin sesión) que carga TODO lo necesario para
 * la tarjeta "Programa Semanal de Predicación" en una sola llamada RPC.
 */
export function useProgramaPredicacionPublico(
  congregacionId: string | null | undefined,
  fechaInicio: string,
  fechaFin: string
) {
  const query = useQuery({
    queryKey: ["predicacion-publico", congregacionId, fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_predicacion_publico_completo" as never,
        {
          _congregacion_id: congregacionId,
          _desde: fechaInicio,
          _hasta: fechaFin,
        } as never
      );
      if (error) throw error;
      const raw = data as unknown as PublicoCompleto;
      const programa = (raw.programa || []).map((p) => ({
        ...p,
        asignaciones_grupos: (Array.isArray(p.asignaciones_grupos)
          ? p.asignaciones_grupos
          : []) as AsignacionGrupo[],
      })) as ProgramaConDetalles[];
      return {
        programa,
        horarios: raw.horarios || [],
        puntos: raw.puntos || [],
        territorios: raw.territorios || [],
        grupos_predicacion: raw.grupos_predicacion || [],
        dias_especiales: raw.dias_especiales || [],
        configuracion_general: raw.configuracion_general || [],
        mensajes_adicionales: raw.mensajes_adicionales || [],
      };
    },
    enabled: !!congregacionId && !!fechaInicio && !!fechaFin,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
