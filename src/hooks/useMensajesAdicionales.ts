import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";

export type ModuloMensaje = "predicacion" | "asignaciones_servicio";

export interface MensajeAdicional {
  id: string;
  fecha: string;
  mensaje: string;
  color: string;
  activo: boolean;
  created_at: string;
  modulo: "predicacion" | "asignaciones_servicio" | "ambos";
}

export function useMensajesAdicionales(modulo: ModuloMensaje = "predicacion") {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const congregacionId = useCongregacionId();

  // Filtra mensajes del módulo solicitado más los marcados como "ambos"
  const modulosFiltro = [modulo, "ambos"];

  const mensajesQuery = useQuery({
    queryKey: ["mensajes-adicionales", congregacionId, modulo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensajes_adicionales")
        .select("*")
        .eq("activo", true)
        .eq("congregacion_id", congregacionId)
        .in("modulo", modulosFiltro)
        .order("fecha");
      if (error) throw error;
      return data as MensajeAdicional[];
    },
    enabled: !!congregacionId,
  });

  const crearMensaje = useMutation({
    mutationFn: async (data: {
      fecha: string;
      mensaje: string;
      color?: string;
      modulo?: "predicacion" | "asignaciones_servicio" | "ambos";
    }) => {
      const { error } = await supabase.from("mensajes_adicionales").insert({
        fecha: data.fecha,
        mensaje: data.mensaje,
        color: data.color || "#1e3a5f",
        modulo: data.modulo || modulo,
        congregacion_id: congregacionId,
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

  const actualizarMensaje = useMutation({
    mutationFn: async (data: {
      id: string;
      mensaje: string;
      color: string;
      modulo?: "predicacion" | "asignaciones_servicio" | "ambos";
    }) => {
      const update: any = { mensaje: data.mensaje, color: data.color };
      if (data.modulo) update.modulo = data.modulo;
      const { error } = await supabase
        .from("mensajes_adicionales")
        .update(update)
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes-adicionales"] });
      toast({ title: "Mensaje actualizado" });
    },
    onError: () => {
      toast({ title: "Error al actualizar mensaje", variant: "destructive" });
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
    actualizarMensaje,
    eliminarMensaje,
  };
}
