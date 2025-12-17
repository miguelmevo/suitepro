import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DiaEspecial {
  id: string;
  nombre: string;
  fecha: string;
  bloqueo_tipo: "completo" | "manana" | "tarde";
  activo: boolean;
  created_at: string;
}

export function useDiasEspeciales() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const diasQuery = useQuery({
    queryKey: ["dias-especiales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dias_especiales")
        .select("*")
        .eq("activo", true)
        .order("fecha");
      if (error) throw error;
      return data as DiaEspecial[];
    },
  });

  const crearDiaEspecial = useMutation({
    mutationFn: async (data: {
      nombre: string;
      fecha: string;
      bloqueo_tipo: "completo" | "manana" | "tarde";
    }) => {
      const { error } = await supabase.from("dias_especiales").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales"] });
      toast({ title: "Día especial creado" });
    },
    onError: () => {
      toast({ title: "Error al crear día especial", variant: "destructive" });
    },
  });

  const eliminarDiaEspecial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dias_especiales")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales"] });
      toast({ title: "Día especial eliminado" });
    },
    onError: () => {
      toast({ title: "Error al eliminar", variant: "destructive" });
    },
  });

  return {
    diasEspeciales: diasQuery.data || [],
    isLoading: diasQuery.isLoading,
    crearDiaEspecial,
    eliminarDiaEspecial,
  };
}
