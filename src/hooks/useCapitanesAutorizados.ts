import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";

export interface CapitanAutorizado {
  participante_id: string;
  nombre: string;
  apellido: string;
  tiene_usuario: boolean;
  email: string | null;
  cuenta_activa: boolean | null;
}

export interface Reemplazo {
  tipo: "programa" | "fija";
  id: string;
  nuevo_capitan_id: string | null;
}

const ERRORES: Record<string, string> = {
  solo_varones_aprobados: "Solo pueden ser capitanes los varones aprobados y activos.",
  not_authorized: "No tienes permiso para hacer esto.",
  participante_no_encontrado: "No se encontró al participante.",
};

const mensajeError = (e: any) => ERRORES[e?.message] ?? e?.message ?? "No se pudo completar la acción.";

/**
 * Capitanes autorizados = participantes con "Capitán de Grupo" marcado en su
 * ficha. Agregar y quitar pasan por funciones del servidor (permiso propio del
 * módulo, no dependen de poder editar participantes).
 */
export function useCapitanesAutorizados() {
  const { toast } = useToast();
  const congregacionId = useCongregacionId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["capitanes-autorizados", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_capitanes_autorizados", {
        _congregacion_id: congregacionId as string,
      });
      if (error) throw error;
      return (data ?? []) as CapitanAutorizado[];
    },
    enabled: !!congregacionId,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["capitanes-autorizados"] });
    queryClient.invalidateQueries({ queryKey: ["participantes"] });
    queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
    queryClient.invalidateQueries({ queryKey: ["capitanes-futuras"] });
  };

  const agregar = useMutation({
    mutationFn: async (participanteId: string) => {
      const { error } = await supabase.rpc("agregar_capitan_grupo", { _participante_id: participanteId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({ title: "Capitán agregado", description: "Ya tiene marcado \"Capitán de Grupo\" en su ficha." });
    },
    onError: (e: any) => toast({ title: "Error", description: mensajeError(e), variant: "destructive" }),
  });

  const quitar = useMutation({
    mutationFn: async ({ participanteId, reemplazos }: { participanteId: string; reemplazos: Reemplazo[] }) => {
      const { error } = await supabase.rpc("quitar_capitan_grupo", {
        _participante_id: participanteId,
        _reemplazos: reemplazos as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({ title: "Capitán eliminado", description: "Se desmarcó \"Capitán de Grupo\" en su ficha." });
    },
    onError: (e: any) => toast({ title: "Error", description: mensajeError(e), variant: "destructive" }),
  });

  return { capitanes: query.data ?? [], isLoading: query.isLoading, agregar, quitar };
}
