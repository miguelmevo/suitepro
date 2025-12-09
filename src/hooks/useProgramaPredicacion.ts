import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProgramaConDetalles, HorarioSalida, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";

export function useProgramaPredicacion(fechaInicio: string, fechaFin: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const programaQuery = useQuery({
    queryKey: ["programa-predicacion", fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programa_predicacion")
        .select(`
          *,
          horario:horarios_salida(*),
          punto_encuentro:puntos_encuentro(*),
          territorio:territorios(*),
          capitan:participantes(id, nombre, apellido)
        `)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
        .eq("activo", true)
        .order("fecha")
        .order("horario_id");

      if (error) throw error;
      return data as ProgramaConDetalles[];
    },
    enabled: !!fechaInicio && !!fechaFin,
  });

  const horariosQuery = useQuery({
    queryKey: ["horarios-salida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("horarios_salida")
        .select("*")
        .eq("activo", true)
        .order("orden");
      if (error) throw error;
      return data as HorarioSalida[];
    },
  });

  const puntosQuery = useQuery({
    queryKey: ["puntos-encuentro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("puntos_encuentro")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data as PuntoEncuentro[];
    },
  });

  const territoriosQuery = useQuery({
    queryKey: ["territorios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("territorios")
        .select("*")
        .eq("activo", true)
        .order("numero");
      if (error) throw error;
      return data as Territorio[];
    },
  });

  const crearEntrada = useMutation({
    mutationFn: async (data: {
      fecha: string;
      horario_id?: string;
      punto_encuentro_id?: string;
      territorio_id?: string;
      capitan_id?: string;
      es_mensaje_especial?: boolean;
      mensaje_especial?: string;
      colspan_completo?: boolean;
    }) => {
      const { error } = await supabase.from("programa_predicacion").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
      toast({ title: "Entrada creada" });
    },
    onError: () => {
      toast({ title: "Error al crear entrada", variant: "destructive" });
    },
  });

  const actualizarEntrada = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      horario_id: string;
      punto_encuentro_id: string;
      territorio_id: string;
      capitan_id: string;
      es_mensaje_especial: boolean;
      mensaje_especial: string;
      colspan_completo: boolean;
    }>) => {
      const { error } = await supabase
        .from("programa_predicacion")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
      toast({ title: "Entrada actualizada" });
    },
    onError: () => {
      toast({ title: "Error al actualizar", variant: "destructive" });
    },
  });

  const eliminarEntrada = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("programa_predicacion")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
      toast({ title: "Entrada eliminada" });
    },
    onError: () => {
      toast({ title: "Error al eliminar", variant: "destructive" });
    },
  });

  return {
    programa: programaQuery.data || [],
    horarios: horariosQuery.data || [],
    puntos: puntosQuery.data || [],
    territorios: territoriosQuery.data || [],
    isLoading: programaQuery.isLoading || horariosQuery.isLoading,
    crearEntrada,
    actualizarEntrada,
    eliminarEntrada,
  };
}
