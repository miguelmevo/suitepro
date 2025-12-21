import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MensajeAdicional {
  id: string;
  fecha: string;
  mensaje: string;
  color: string;
  activo: boolean;
  created_at: string;
}

export function useMensajesAdicionales() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mensajesQuery = useQuery({
    queryKey: ["mensajes-adicionales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensajes_adicionales")
        .select("*")
        .eq("activo", true)
        .order("fecha");
      if (error) throw error;
      return data as MensajeAdicional[];
    },
  });

  const crearMensaje = useMutation({
    mutationFn: async (data: {
      fecha: string;
      mensaje: string;
      color?: string;
    }) => {
      const { error } = await supabase.from("mensajes_adicionales").insert({
        fecha: data.fecha,
        mensaje: data.mensaje,
        color: data.color || "#1e3a5f",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes-adicionales"] });
      toast({ title: "Mensaje adicional creado" });
    },
    onError: () => {
      toast({ title: "Error al crear mensaje", variant: "destructive" });
    },
  });

  const eliminarMensaje = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mensajes_adicionales")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes-adicionales"] });
      toast({ title: "Mensaje eliminado" });
    },
    onError: () => {
      toast({ title: "Error al eliminar mensaje", variant: "destructive" });
    },
  });

  return {
    mensajesAdicionales: mensajesQuery.data || [],
    isLoading: mensajesQuery.isLoading,
    crearMensaje,
    eliminarMensaje,
  };
}
