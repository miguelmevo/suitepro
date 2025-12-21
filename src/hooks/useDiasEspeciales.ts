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
      // Crear el día especial
      const { error } = await supabase.from("dias_especiales").insert(data);
      if (error) throw error;

      // También crear la entrada en programa_predicacion para mostrarlo en la tabla
      const { error: errorPrograma } = await supabase.from("programa_predicacion").insert({
        fecha: data.fecha,
        es_mensaje_especial: true,
        mensaje_especial: data.nombre,
        colspan_completo: true,
      });
      if (errorPrograma) throw errorPrograma;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales"] });
      queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
      toast({ title: "Día especial creado" });
    },
    onError: () => {
      toast({ title: "Error al crear día especial", variant: "destructive" });
    },
  });

  const actualizarDiaEspecial = useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      nombre?: string;
      fecha?: string;
      bloqueo_tipo?: "completo" | "manana" | "tarde";
    }) => {
      const { error } = await supabase
        .from("dias_especiales")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales"] });
      toast({ title: "Día especial actualizado" });
    },
    onError: () => {
      toast({ title: "Error al actualizar", variant: "destructive" });
    },
  });

  const eliminarDiaEspecial = useMutation({
    mutationFn: async (id: string) => {
      // Primero obtener el día especial para saber su fecha y nombre
      const { data: diaEspecial, error: fetchError } = await supabase
        .from("dias_especiales")
        .select("fecha, nombre")
        .eq("id", id)
        .single();
      
      if (fetchError) throw fetchError;

      // Desactivar el día especial
      const { error } = await supabase
        .from("dias_especiales")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;

      // También eliminar la entrada correspondiente en programa_predicacion
      if (diaEspecial) {
        const { error: errorPrograma } = await supabase
          .from("programa_predicacion")
          .update({ activo: false })
          .eq("fecha", diaEspecial.fecha)
          .eq("es_mensaje_especial", true)
          .eq("mensaje_especial", diaEspecial.nombre);
        if (errorPrograma) console.error("Error eliminando entrada de programa:", errorPrograma);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales"] });
      queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
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
    actualizarDiaEspecial,
    eliminarDiaEspecial,
  };
}
