import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";

export type ProgramaAplicable = "reunion_publica" | "asignaciones_servicio" | "predicacion" | "vida_ministerio";

export interface DiaEspecial {
  id: string;
  nombre: string;
  bloqueo_tipo: "completo" | "manana" | "tarde";
  color: string;
  /** Si tiene fecha, ese día se auto-aplica en los programas de `programas`
   * al abrir el mes correspondiente. Sin fecha, es un motivo reutilizable
   * que el usuario asigna a mano en cualquier fecha desde cada programa. */
  fecha: string | null;
  /** Fin del rango (opcional, dentro de la misma semana que `fecha`). */
  fecha_fin: string | null;
  programas: ProgramaAplicable[];
  /** Si aparece en la tarjeta "Eventos" de Inicio. Independiente de `programas`. */
  mostrar_en_inicio: boolean;
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
      return data as DiaEspecial[];
    },
    enabled: !!congregacionId,
  });

  const crearDiaEspecial = useMutation({
    mutationFn: async (data: {
      nombre: string;
      bloqueo_tipo: "completo" | "manana" | "tarde";
      color?: string;
      fecha?: string | null;
      fecha_fin?: string | null;
      programas?: ProgramaAplicable[];
      mostrar_en_inicio?: boolean;
    }) => {
      const { error } = await supabase.from("dias_especiales").insert({
        nombre: data.nombre,
        bloqueo_tipo: data.bloqueo_tipo,
        color: data.color,
        fecha: data.fecha ?? null,
        fecha_fin: data.fecha_fin ?? null,
        programas: data.programas ?? [],
        mostrar_en_inicio: data.mostrar_en_inicio ?? false,
        congregacion_id: congregacionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales"] });
      queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
      toast({ title: "Día especial creado" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Error al crear día especial", variant: "destructive" });
    },
  });

  const actualizarDiaEspecial = useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      nombre?: string;
      bloqueo_tipo?: "completo" | "manana" | "tarde";
      color?: string;
      fecha?: string | null;
      fecha_fin?: string | null;
      programas?: ProgramaAplicable[];
      mostrar_en_inicio?: boolean;
    }) => {
      const { error } = await supabase
        .from("dias_especiales")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias-especiales"] });
      queryClient.invalidateQueries({ queryKey: ["rp-dias-especiales"] });
      queryClient.invalidateQueries({ queryKey: ["asig-serv-dias-especiales"] });
      toast({ title: "Día especial actualizado" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Error al actualizar", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["rp-dias-especiales"] });
      queryClient.invalidateQueries({ queryKey: ["asig-serv-dias-especiales"] });
      toast({ title: "Día especial eliminado" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Error al eliminar", variant: "destructive" });
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
