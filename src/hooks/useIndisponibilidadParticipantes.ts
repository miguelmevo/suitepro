import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface IndisponibilidadParticipante {
  id: string;
  participante_id: string;
  congregacion_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo: string | null;
  tipo_responsabilidad: string[];
  activo: boolean;
  created_at: string;
  updated_at: string;
  participante?: {
    id: string;
    nombre: string;
    apellido: string;
  };
}

export interface CreateIndisponibilidadData {
  participante_id: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  motivo?: string;
  tipo_responsabilidad: string[];
}

export interface UpdateIndisponibilidadData {
  id: string;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  motivo?: string | null;
  tipo_responsabilidad?: string[];
}

export const TIPOS_RESPONSABILIDAD = [
  { value: "todas", label: "Todas" },
  { value: "predicacion", label: "Predicación" },
  { value: "reunion_vmc", label: "Reunión Vida y Ministerio" },
  { value: "reunion_publica", label: "Reunión Pública" },
  { value: "servicio", label: "Asignaciones de Servicio" },
  { value: "carrito", label: "Carrito" },
] as const;

export function useIndisponibilidadParticipantes(participanteId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener indisponibilidades (por participante o todas)
  const query = useQuery({
    queryKey: ["indisponibilidad-participantes", participanteId],
    queryFn: async () => {
      let queryBuilder = supabase
        .from("indisponibilidad_participantes")
        .select(`
          *,
          participante:participantes(id, nombre, apellido)
        `)
        .eq("activo", true)
        .order("fecha_inicio", { ascending: true });

      if (participanteId) {
        queryBuilder = queryBuilder.eq("participante_id", participanteId);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as IndisponibilidadParticipante[];
    },
  });

  // Crear indisponibilidad
  const crearIndisponibilidad = useMutation({
    mutationFn: async (data: CreateIndisponibilidadData) => {
      // Obtener congregacion_id del usuario
      const { data: congregacionData, error: congregacionError } = await supabase
        .rpc("get_user_congregacion_id");

      if (congregacionError) throw congregacionError;

      const { data: result, error } = await supabase
        .from("indisponibilidad_participantes")
        .insert({
          participante_id: data.participante_id,
          congregacion_id: congregacionData,
          fecha_inicio: data.fecha_inicio,
          fecha_fin: data.fecha_fin || null,
          motivo: data.motivo || null,
          tipo_responsabilidad: data.tipo_responsabilidad,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indisponibilidad-participantes"] });
      toast({
        title: "Indisponibilidad registrada",
        description: "La fecha de indisponibilidad se guardó correctamente.",
      });
    },
    onError: (error) => {
      console.error("Error al crear indisponibilidad:", error);
      toast({
        title: "Error",
        description: "No se pudo registrar la indisponibilidad.",
        variant: "destructive",
      });
    },
  });

  // Actualizar indisponibilidad
  const actualizarIndisponibilidad = useMutation({
    mutationFn: async (data: UpdateIndisponibilidadData) => {
      const { id, ...updateData } = data;
      const { data: result, error } = await supabase
        .from("indisponibilidad_participantes")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indisponibilidad-participantes"] });
      toast({
        title: "Indisponibilidad actualizada",
        description: "Los cambios se guardaron correctamente.",
      });
    },
    onError: (error) => {
      console.error("Error al actualizar indisponibilidad:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la indisponibilidad.",
        variant: "destructive",
      });
    },
  });

  // Eliminar indisponibilidad (soft delete)
  const eliminarIndisponibilidad = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("indisponibilidad_participantes")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indisponibilidad-participantes"] });
      toast({
        title: "Indisponibilidad eliminada",
        description: "El registro se eliminó correctamente.",
      });
    },
    onError: (error) => {
      console.error("Error al eliminar indisponibilidad:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la indisponibilidad.",
        variant: "destructive",
      });
    },
  });

  // Verificar si un participante está disponible en una fecha para un tipo de responsabilidad
  const verificarDisponibilidad = async (
    participanteId: string,
    fecha: string,
    tipoResponsabilidad: string = "todas"
  ): Promise<boolean> => {
    const { data, error } = await supabase
      .from("indisponibilidad_participantes")
      .select("id, tipo_responsabilidad")
      .eq("participante_id", participanteId)
      .eq("activo", true)
      .lte("fecha_inicio", fecha)
      .or(`fecha_fin.gte.${fecha},fecha_fin.is.null`);

    if (error) {
      console.error("Error verificando disponibilidad:", error);
      return true; // En caso de error, asumir disponible
    }

    // Verificar si alguna indisponibilidad aplica
    return !data.some((ind) => 
      ind.tipo_responsabilidad.includes("todas") || 
      ind.tipo_responsabilidad.includes(tipoResponsabilidad)
    );
  };

  return {
    indisponibilidades: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    crearIndisponibilidad,
    actualizarIndisponibilidad,
    eliminarIndisponibilidad,
    verificarDisponibilidad,
  };
}
