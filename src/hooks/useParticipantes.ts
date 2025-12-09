import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Participante } from "@/types/grupos-servicio";
import { useToast } from "@/hooks/use-toast";

export function useParticipantes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const participantesQuery = useQuery({
    queryKey: ["participantes"],
    queryFn: async (): Promise<Participante[]> => {
      const { data, error } = await supabase
        .from("participantes")
        .select("*")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      return data;
    },
  });

  const crearParticipante = useMutation({
    mutationFn: async (data: { nombre: string; apellido: string; telefono?: string }) => {
      const { data: participante, error } = await supabase
        .from("participantes")
        .insert(data)
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