import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";

export type TipoReunionBloqueable = "vida_ministerio" | "reunion_publica";

export interface DiaEspecial {
  id: string;
  nombre: string;
  bloqueo_tipo: "completo" | "manana" | "tarde";
  bloquea_reuniones: string[];
  fecha: string | null;
  color: string;
  activo: boolean;
  created_at: string;
}

export function useDiasEspeciales() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const congregacionId = useCongregacionId();

  const diasQuery = useQuery({
    queryKey: ["dias-especiales", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dias_especiales")
        .select("*")
        .eq("activo", true)
        .eq("congregacion_id", congregacionId)
        .order("fecha");
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        bloquea_reuniones: d.bloquea_reuniones || [],
      })) as DiaEspecial[];
    },
    enabled: !!congregacionId,
  });

  const crearDiaEspecial = useMutation({
    mutationFn: async (data: {
      nombre: string;
      bloqueo_tipo: "completo" | "manana" | "tarde";
      fecha?: string | null;
      color?: string;
      bloquea_reuniones?: string[];
    }) => {
      const { error } = await supabase.from("dias_especiales").insert({
        nombre: data.nombre,
        bloqueo_tipo: data.bloqueo_tipo,
        fecha: data.fecha ?? null,
        color: data.color ?? "#1e3a5f",
        bloquea_reuniones: data.bloquea_reuniones ?? [],
        congregacion_id: congregacionId,
      });
      if (error) throw error;
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
      bloqueo_tipo?: "completo" | "manana" | "tarde";
      fecha?: string | null;
      color?: string;
      bloquea_reuniones?: string[];
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

  /**
   * Devuelve el Día Especial que bloquea la reunión `tipo` en la fecha exacta `fechaISO` (YYYY-MM-DD), si existe.
   */
  const getBloqueoEnFecha = (fechaISO: string | null | undefined, tipo: TipoReunionBloqueable): DiaEspecial | null => {
    if (!fechaISO) return null;
    const lista = diasQuery.data || [];
    return (
      lista.find(
        (d) =>
          d.activo &&
          d.fecha === fechaISO &&
          Array.isArray(d.bloquea_reuniones) &&
          d.bloquea_reuniones.includes(tipo)
      ) || null
    );
  };

  /**
   * Devuelve el Día Especial que bloquea la reunión `tipo` en cualquier fecha del rango (ambos YYYY-MM-DD inclusivos).
   */
  const getBloqueoEnRango = (desdeISO: string, hastaISO: string, tipo: TipoReunionBloqueable): DiaEspecial | null => {
    const lista = diasQuery.data || [];
    return (
      lista.find(
        (d) =>
          d.activo &&
          d.fecha &&
          d.fecha >= desdeISO &&
          d.fecha <= hastaISO &&
          Array.isArray(d.bloquea_reuniones) &&
          d.bloquea_reuniones.includes(tipo)
      ) || null
    );
  };

  return {
    diasEspeciales: diasQuery.data || [],
    isLoading: diasQuery.isLoading,
    crearDiaEspecial,
    actualizarDiaEspecial,
    eliminarDiaEspecial,
    getBloqueoEnFecha,
    getBloqueoEnRango,
  };
}
