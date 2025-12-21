import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DisponibilidadCapitan {
  id: string;
  capitan_id: string;
  dia_semana: number;
  bloque_horario: "manana" | "tarde" | "ambos";
  activo: boolean;
  created_at: string;
  capitan?: {
    id: string;
    nombre: string;
    apellido: string;
  };
}

export interface CreateDisponibilidadData {
  capitan_id: string;
  dia_semana: number;
  bloque_horario: "manana" | "tarde" | "ambos";
}

export function useDisponibilidadCapitanes() {
  const queryClient = useQueryClient();

  // Obtener todas las disponibilidades
  const disponibilidadesQuery = useQuery({
    queryKey: ["disponibilidad-capitanes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilidad_capitanes")
        .select(`
          *,
          capitan:participantes!capitan_id(id, nombre, apellido)
        `)
        .eq("activo", true)
        .order("capitan_id")
        .order("dia_semana");

      if (error) throw error;
      return data as DisponibilidadCapitan[];
    },
  });

  // Obtener disponibilidad de un capitán específico
  const obtenerDisponibilidadCapitan = (capitanId: string) => {
    return disponibilidadesQuery.data?.filter(d => d.capitan_id === capitanId) || [];
  };

  // Verificar si un capitán está disponible para un día/bloque específico
  const estaDisponible = (
    capitanId: string,
    diaSemana: number,
    esManana: boolean
  ): boolean => {
    const disponibilidades = disponibilidadesQuery.data || [];
    
    // Si el capitán no tiene registros de disponibilidad, está disponible siempre
    const disponibilidadesCapitan = disponibilidades.filter(d => d.capitan_id === capitanId);
    if (disponibilidadesCapitan.length === 0) {
      return true;
    }

    // Buscar si tiene disponibilidad para ese día
    const disponibilidadDia = disponibilidadesCapitan.find(d => d.dia_semana === diaSemana);
    if (!disponibilidadDia) {
      return false; // No tiene entrada para ese día = no disponible
    }

    // Verificar el bloque horario
    if (disponibilidadDia.bloque_horario === "ambos") {
      return true;
    }
    if (disponibilidadDia.bloque_horario === "manana" && esManana) {
      return true;
    }
    if (disponibilidadDia.bloque_horario === "tarde" && !esManana) {
      return true;
    }

    return false;
  };

  // Crear disponibilidad
  const crearDisponibilidad = useMutation({
    mutationFn: async (data: CreateDisponibilidadData) => {
      const { data: result, error } = await supabase
        .from("disponibilidad_capitanes")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disponibilidad-capitanes"] });
    },
  });

  // Actualizar disponibilidad
  const actualizarDisponibilidad = useMutation({
    mutationFn: async ({ id, bloque_horario }: { id: string; bloque_horario: "manana" | "tarde" | "ambos" }) => {
      const { data, error } = await supabase
        .from("disponibilidad_capitanes")
        .update({ bloque_horario })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disponibilidad-capitanes"] });
    },
  });

  // Eliminar disponibilidad
  const eliminarDisponibilidad = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("disponibilidad_capitanes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disponibilidad-capitanes"] });
    },
  });

  // Guardar disponibilidad completa para un capitán (reemplaza todas las entradas)
  const guardarDisponibilidadCompleta = useMutation({
    mutationFn: async ({ 
      capitanId, 
      disponibilidades 
    }: { 
      capitanId: string; 
      disponibilidades: { dia_semana: number; bloque_horario: "manana" | "tarde" | "ambos" }[] 
    }) => {
      // Eliminar disponibilidades existentes del capitán
      const { error: deleteError } = await supabase
        .from("disponibilidad_capitanes")
        .delete()
        .eq("capitan_id", capitanId);

      if (deleteError) throw deleteError;

      // Insertar nuevas disponibilidades
      if (disponibilidades.length > 0) {
        const { error: insertError } = await supabase
          .from("disponibilidad_capitanes")
          .insert(
            disponibilidades.map(d => ({
              capitan_id: capitanId,
              dia_semana: d.dia_semana,
              bloque_horario: d.bloque_horario,
            }))
          );

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disponibilidad-capitanes"] });
    },
  });

  return {
    disponibilidades: disponibilidadesQuery.data || [],
    isLoading: disponibilidadesQuery.isLoading,
    obtenerDisponibilidadCapitan,
    estaDisponible,
    crearDisponibilidad,
    actualizarDisponibilidad,
    eliminarDisponibilidad,
    guardarDisponibilidadCompleta,
  };
}
