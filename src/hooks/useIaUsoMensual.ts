import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LIMITE_IA_MENSUAL = 5;

function periodoActual() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

export function useIaUsoMensual(congregacionId: string | null) {
  const periodo = periodoActual();
  const query = useQuery({
    queryKey: ["ia-uso-mensual", congregacionId, periodo],
    queryFn: async (): Promise<number> => {
      if (!congregacionId) return 0;
      const { data, error } = await supabase
        .from("ia_uso_mensual")
        .select("usos")
        .eq("congregacion_id", congregacionId)
        .eq("periodo", periodo)
        .maybeSingle();
      if (error) throw error;
      return data?.usos ?? 0;
    },
    enabled: !!congregacionId,
  });

  const usos = query.data ?? 0;
  return {
    usos,
    limite: LIMITE_IA_MENSUAL,
    agotado: usos >= LIMITE_IA_MENSUAL,
    isLoading: query.isLoading,
  };
}

export function useInvalidarIaUsoMensual() {
  const queryClient = useQueryClient();
  return (congregacionId: string | null) =>
    queryClient.invalidateQueries({ queryKey: ["ia-uso-mensual", congregacionId] });
}
