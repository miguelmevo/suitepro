import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacion } from "@/contexts/CongregacionContext";

export interface ProgramaReunionPublica {
  id: string;
  congregacion_id: string;
  fecha: string;
  presidente_id: string | null;
  orador_id: string | null;
  orador_nombre: string | null;
  orador_congregacion: string | null;
  orador_suplente_id: string | null;
  orador_saliente_id: string | null;
  conductor_atalaya_id: string | null;
  lector_atalaya_id: string | null;
  tema_discurso: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConductorAtalaya {
  id: string;
  congregacion_id: string;
  participante_id: string;
  orden: number;
  activo: boolean;
  created_at: string;
}

export interface LectorAtalayaElegible {
  id: string;
  congregacion_id: string;
  participante_id: string;
  activo: boolean;
  created_at: string;
}

export function useReunionPublica(mes?: number, anio?: number) {
  const queryClient = useQueryClient();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || null;

  // Obtener programa del mes
  const { data: programa, isLoading: isLoadingPrograma } = useQuery({
    queryKey: ["programa-reunion-publica", congregacionId, mes, anio],
    queryFn: async () => {
      if (!congregacionId || mes === undefined || anio === undefined) return [];

      const fechaInicio = new Date(anio, mes, 1);
      const fechaFin = new Date(anio, mes + 1, 0);

      const { data, error } = await supabase
        .from("programa_reunion_publica")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gte("fecha", fechaInicio.toISOString().split("T")[0])
        .lte("fecha", fechaFin.toISOString().split("T")[0])
        .order("fecha", { ascending: true });

      if (error) throw error;
      return data as ProgramaReunionPublica[];
    },
    enabled: !!congregacionId && mes !== undefined && anio !== undefined,
  });

  // Obtener conductores de La Atalaya
  const { data: conductores, isLoading: isLoadingConductores } = useQuery({
    queryKey: ["conductores-atalaya", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];

      const { data, error } = await supabase
        .from("conductores_atalaya")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (error) throw error;
      return data as ConductorAtalaya[];
    },
    enabled: !!congregacionId,
  });

  // Obtener lectores elegibles
  const { data: lectoresElegibles, isLoading: isLoadingLectores } = useQuery({
    queryKey: ["lectores-atalaya-elegibles", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];

      const { data, error } = await supabase
        .from("lectores_atalaya_elegibles")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true);

      if (error) throw error;
      return data as LectorAtalayaElegible[];
    },
    enabled: !!congregacionId,
  });

  // Guardar/actualizar programa
  const guardarPrograma = useMutation({
    mutationFn: async (data: Partial<ProgramaReunionPublica> & { fecha: string }) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");

      const { data: result, error } = await supabase
        .from("programa_reunion_publica")
        .upsert(
          {
            ...data,
            congregacion_id: congregacionId,
          },
          { onConflict: "congregacion_id,fecha" }
        )
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programa-reunion-publica"] });
      toast.success("Programa guardado");
    },
    onError: (error) => {
      console.error("Error al guardar programa:", error);
      toast.error("Error al guardar el programa");
    },
  });

  // Agregar conductor de Atalaya
  const agregarConductor = useMutation({
    mutationFn: async (participanteId: string) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");

      // Verificar que no haya más de 3
      const { count } = await supabase
        .from("conductores_atalaya")
        .select("*", { count: "exact", head: true })
        .eq("congregacion_id", congregacionId)
        .eq("activo", true);

      if (count && count >= 3) {
        throw new Error("Solo se permiten 3 conductores de La Atalaya");
      }

      const { data, error } = await supabase
        .from("conductores_atalaya")
        .insert({
          congregacion_id: congregacionId,
          participante_id: participanteId,
          orden: (count || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conductores-atalaya"] });
      toast.success("Conductor agregado");
    },
    onError: (error: Error) => {
      console.error("Error al agregar conductor:", error);
      toast.error(error.message || "Error al agregar conductor");
    },
  });

  // Eliminar conductor de Atalaya
  const eliminarConductor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("conductores_atalaya")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conductores-atalaya"] });
      toast.success("Conductor eliminado");
    },
    onError: (error) => {
      console.error("Error al eliminar conductor:", error);
      toast.error("Error al eliminar conductor");
    },
  });

  // Agregar lector elegible
  const agregarLectorElegible = useMutation({
    mutationFn: async (participanteId: string) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");

      const { data, error } = await supabase
        .from("lectores_atalaya_elegibles")
        .insert({
          congregacion_id: congregacionId,
          participante_id: participanteId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lectores-atalaya-elegibles"] });
      toast.success("Lector agregado");
    },
    onError: (error) => {
      console.error("Error al agregar lector:", error);
      toast.error("Error al agregar lector");
    },
  });

  // Eliminar lector elegible
  const eliminarLectorElegible = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lectores_atalaya_elegibles")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lectores-atalaya-elegibles"] });
      toast.success("Lector eliminado");
    },
    onError: (error) => {
      console.error("Error al eliminar lector:", error);
      toast.error("Error al eliminar lector");
    },
  });

  return {
    programa,
    conductores,
    lectoresElegibles,
    isLoading: isLoadingPrograma || isLoadingConductores || isLoadingLectores,
    guardarPrograma,
    agregarConductor,
    eliminarConductor,
    agregarLectorElegible,
    eliminarLectorElegible,
  };
}
