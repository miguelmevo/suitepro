import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";

export interface Participante {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  estado_aprobado: boolean;
  responsabilidad: string[];
  responsabilidad_adicional: string | null;
  grupo_predicacion_id: string | null;
  restriccion_disponibilidad: string | null;
  es_capitan_grupo: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateParticipanteData {
  nombre: string;
  apellido: string;
  telefono?: string;
  estado_aprobado?: boolean;
  responsabilidad?: string[];
  responsabilidad_adicional?: string | null;
  grupo_predicacion_id?: string | null;
  restriccion_disponibilidad?: string;
  es_capitan_grupo?: boolean;
}

export function useParticipantes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const congregacionId = useCongregacionId();

  const participantesQuery = useQuery({
    queryKey: ["participantes", congregacionId],
    queryFn: async (): Promise<Participante[]> => {
      // Use the secure function that masks phone numbers for non-admin/editor users
      const { data, error } = await supabase
        .rpc("get_participantes_seguros");

      if (error) throw error;
      
      // Sort by apellido and nombre
      return (data ?? []).sort((a, b) => {
        const apellidoCompare = (a.apellido || "").localeCompare(b.apellido || "");
        if (apellidoCompare !== 0) return apellidoCompare;
        return (a.nombre || "").localeCompare(b.nombre || "");
      });
    },
    enabled: !!congregacionId,
  });

  const crearParticipante = useMutation({
    mutationFn: async (data: CreateParticipanteData) => {
      const { data: participante, error } = await supabase
        .from("participantes")
        .insert({
          ...data,
          congregacion_id: congregacionId,
        })
        .select()
        .single();

      if (error) throw error;
      return participante;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes"] });
      toast({ title: "Participante creado exitosamente" });
    },
    onError: (error) => {
      toast({ title: "Error al crear participante", description: error.message, variant: "destructive" });
    },
  });

  const actualizarParticipante = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Participante> & { id: string }) => {
      const { error } = await supabase
        .from("participantes")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes"] });
      toast({ title: "Participante actualizado" });
    },
    onError: (error) => {
      toast({ title: "Error al actualizar participante", description: error.message, variant: "destructive" });
    },
  });

  const eliminarParticipante = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("participantes")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes"] });
      toast({ title: "Participante eliminado" });
    },
    onError: (error) => {
      toast({ title: "Error al eliminar participante", description: error.message, variant: "destructive" });
    },
  });

  return {
    participantes: participantesQuery.data ?? [],
    isLoading: participantesQuery.isLoading,
    error: participantesQuery.error,
    crearParticipante,
    actualizarParticipante,
    eliminarParticipante,
  };
}
