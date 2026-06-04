import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";

export interface GrupoPredicacion {
  id: string;
  numero: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  superintendente?: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
  auxiliar?: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
}

export function useGruposPredicacion() {
  const queryClient = useQueryClient();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id;

  const { data: grupos, isLoading } = useQuery({
    queryKey: ["grupos-predicacion", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];

      // 1. Cargar grupos
      const { data: gruposData, error } = await supabase
        .from("grupos_predicacion")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .order("numero", { ascending: true });

      if (error) throw error;
      if (!gruposData || gruposData.length === 0) return [] as GrupoPredicacion[];

      // 2. Cargar SG/AG vía RPC SECURITY DEFINER (visible para todos los usuarios de la congregación)
      const { data: liderazgo, error: errorLid } = await (supabase as any).rpc("get_liderazgo_grupos", {
        _congregacion_id: congregacionId,
      });


      if (errorLid) throw errorLid;

      const supMap = new Map<string, { id: string; nombre: string; apellido: string }>();
      const auxMap = new Map<string, { id: string; nombre: string; apellido: string }>();
      (liderazgo || []).forEach((p: any) => {
        if (!p.grupo_predicacion_id) return;
        const persona = { id: p.id, nombre: p.nombre, apellido: p.apellido };
        if (p.responsabilidad_adicional === "superintendente_grupo") supMap.set(p.grupo_predicacion_id, persona);
        else if (p.responsabilidad_adicional === "auxiliar_grupo") auxMap.set(p.grupo_predicacion_id, persona);
      });

      return gruposData.map((g: any) => ({
        ...g,
        superintendente: supMap.get(g.id) || null,
        auxiliar: auxMap.get(g.id) || null,
      })) as GrupoPredicacion[];
    },
    enabled: !!congregacionId,
  });

  const sincronizarGrupos = useMutation({
    mutationFn: async (cantidadGrupos: number) => {
      if (!congregacionId) {
        throw new Error("No hay congregación seleccionada");
      }

      const { data: existentes, error: fetchError } = await supabase
        .from("grupos_predicacion")
        .select("numero, activo")
        .eq("congregacion_id", congregacionId);

      if (fetchError) throw fetchError;

      const gruposMap = new Map(existentes?.map((g) => [g.numero, g.activo]) || []);

      const gruposACrear = [];
      for (let i = 1; i <= cantidadGrupos; i++) {
        if (!gruposMap.has(i)) {
          gruposACrear.push({ numero: i, activo: true, congregacion_id: congregacionId });
        }
      }

      if (gruposACrear.length > 0) {
        const { error: insertError } = await supabase
          .from("grupos_predicacion")
          .insert(gruposACrear);

        if (insertError) throw insertError;
      }

      const { error: updateError } = await supabase
        .from("grupos_predicacion")
        .update({ activo: false })
        .eq("congregacion_id", congregacionId)
        .gt("numero", cantidadGrupos);

      if (updateError) throw updateError;

      const { error: reactivateError } = await supabase
        .from("grupos_predicacion")
        .update({ activo: true })
        .eq("congregacion_id", congregacionId)
        .lte("numero", cantidadGrupos);

      if (reactivateError) throw reactivateError;

      return cantidadGrupos;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos-predicacion", congregacionId] });
    },
    onError: (error) => {
      console.error("Error al sincronizar grupos:", error);
      toast.error("Error al sincronizar grupos");
    },
  });

  return {
    grupos,
    isLoading,
    sincronizarGrupos,
  };
}
