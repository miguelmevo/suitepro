import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CicloTerritorio {
  id: string;
  territorio_id: string;
  congregacion_id: string;
  ciclo_numero: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  completado: boolean;
  created_at: string;
}

export interface ManzanaTrabajada {
  id: string;
  ciclo_id: string;
  manzana_id: string;
  territorio_id: string;
  congregacion_id: string;
  fecha_trabajada: string;
  marcado_por: string;
  created_at: string;
}

interface MarcarManzanaResult {
  ciclo_id: string;
  total_manzanas: number;
  trabajadas: number;
  ciclo_completado: boolean;
}

export function useCiclosTerritorios(territorioId?: string, congregacionId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active cycle for a territory
  const cicloActivoQuery = useQuery({
    queryKey: ["ciclo-activo", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ciclos_territorio")
        .select("*")
        .eq("territorio_id", territorioId!)
        .eq("completado", false)
        .maybeSingle();
      if (error) throw error;
      return data as CicloTerritorio | null;
    },
    enabled: !!territorioId,
  });

  // Fetch worked blocks for the active cycle
  const manzanasTrabajadas = useQuery({
    queryKey: ["manzanas-trabajadas", cicloActivoQuery.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manzanas_trabajadas")
        .select("*")
        .eq("ciclo_id", cicloActivoQuery.data!.id)
        .order("fecha_trabajada");
      if (error) throw error;
      return data as ManzanaTrabajada[];
    },
    enabled: !!cicloActivoQuery.data?.id,
  });

  // Fetch completed cycles history for a territory
  const historialCiclos = useQuery({
    queryKey: ["historial-ciclos", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ciclos_territorio")
        .select("*")
        .eq("territorio_id", territorioId!)
        .eq("completado", true)
        .order("ciclo_numero", { ascending: false });
      if (error) throw error;
      return data as CicloTerritorio[];
    },
    enabled: !!territorioId,
  });

  // Mark a block as worked
  const marcarManzana = useMutation({
    mutationFn: async ({ manzanaId, fechaTrabajada }: { manzanaId: string; fechaTrabajada?: string }) => {
      const { data, error } = await supabase.rpc("marcar_manzana_trabajada", {
        _territorio_id: territorioId!,
        _congregacion_id: congregacionId!,
        _manzana_id: manzanaId,
        _fecha_trabajada: fechaTrabajada || new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      return data as unknown as MarcarManzanaResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ciclo-activo", territorioId] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas-publico", territorioId] });
      queryClient.invalidateQueries({ queryKey: ["historial-ciclos", territorioId] });
      if (result.ciclo_completado) {
        toast({ title: "¡Territorio completado!", description: "Todas las manzanas fueron trabajadas. Se inicia un nuevo ciclo." });
      } else {
        toast({ title: "Manzana registrada" });
      }
    },
    onError: (error: any) => {
      const msg = error.message?.includes("not_authorized_captain")
        ? "Solo los capitanes pueden registrar manzanas"
        : error.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  // Unmark a block
  const desmarcarManzana = useMutation({
    mutationFn: async (manzanaTrabajadaId: string) => {
      const { error } = await supabase.rpc("desmarcar_manzana_trabajada", {
        _manzana_trabajada_id: manzanaTrabajadaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ciclo-activo", territorioId] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas-publico", territorioId] });
      toast({ title: "Manzana desmarcada" });
    },
    onError: (error: any) => {
      const msg = error.message?.includes("cycle_already_completed")
        ? "No se puede desmarcar en un ciclo completado"
        : error.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const trabajadasIds = new Set(
    (manzanasTrabajadas.data || []).map((mt) => mt.manzana_id)
  );

  return {
    cicloActivo: cicloActivoQuery.data,
    manzanasTrabajadas: manzanasTrabajadas.data || [],
    historialCiclos: historialCiclos.data || [],
    trabajadasIds,
    isLoading: cicloActivoQuery.isLoading,
    marcarManzana,
    desmarcarManzana,
  };
}

// Hook for admin: all cycles across all territories
export function useHistorialCiclosAdmin(congregacionId?: string) {
  return useQuery({
    queryKey: ["historial-ciclos-admin", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ciclos_territorio")
        .select("*")
        .eq("congregacion_id", congregacionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CicloTerritorio[];
    },
    enabled: !!congregacionId,
  });
}
