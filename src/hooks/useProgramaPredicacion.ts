import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProgramaConDetalles, HorarioSalida, PuntoEncuentro, Territorio, AsignacionGrupo } from "@/types/programa-predicacion";

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
      
      // Transform the data to ensure asignaciones_grupos is properly typed
      return (data || []).map((item) => ({
        ...item,
        asignaciones_grupos: (Array.isArray(item.asignaciones_grupos) ? item.asignaciones_grupos : []) as unknown as AsignacionGrupo[],
      })) as ProgramaConDetalles[];
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
        .eq("activo", true);
      if (error) throw error;
      // Ordenar numéricamente en JavaScript para manejar correctamente 1, 2, 10, 11
      return (data as Territorio[]).sort((a, b) => {
        const numA = parseInt(a.numero, 10);
        const numB = parseInt(b.numero, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.numero.localeCompare(b.numero);
      });
    },
  });

  const crearEntrada = useMutation({
    mutationFn: async (data: {
      fecha: string;
      horario_id?: string;
      punto_encuentro_id?: string;
      territorio_id?: string;
      territorio_ids?: string[];
      capitan_id?: string;
      es_mensaje_especial?: boolean;
      mensaje_especial?: string;
      colspan_completo?: boolean;
      es_por_grupos?: boolean;
      asignaciones_grupos?: AsignacionGrupo[];
    }) => {
      const insertData = {
        fecha: data.fecha,
        horario_id: data.horario_id,
        punto_encuentro_id: data.punto_encuentro_id,
        capitan_id: data.capitan_id,
        es_mensaje_especial: data.es_mensaje_especial,
        mensaje_especial: data.mensaje_especial,
        colspan_completo: data.colspan_completo,
        es_por_grupos: data.es_por_grupos,
        territorio_ids: data.territorio_ids || (data.territorio_id ? [data.territorio_id] : []),
        asignaciones_grupos: JSON.parse(JSON.stringify(data.asignaciones_grupos || [])),
      };
      const { error } = await supabase.from("programa_predicacion").insert(insertData);
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
      territorio_ids: string[];
      capitan_id: string;
      es_mensaje_especial: boolean;
      mensaje_especial: string;
      colspan_completo: boolean;
      es_por_grupos: boolean;
      asignaciones_grupos: AsignacionGrupo[];
    }>) => {
      const updateData: Record<string, unknown> = {};
      if (data.horario_id !== undefined) updateData.horario_id = data.horario_id;
      if (data.punto_encuentro_id !== undefined) updateData.punto_encuentro_id = data.punto_encuentro_id;
      if (data.capitan_id !== undefined) updateData.capitan_id = data.capitan_id;
      if (data.es_mensaje_especial !== undefined) updateData.es_mensaje_especial = data.es_mensaje_especial;
      if (data.mensaje_especial !== undefined) updateData.mensaje_especial = data.mensaje_especial;
      if (data.colspan_completo !== undefined) updateData.colspan_completo = data.colspan_completo;
      if (data.es_por_grupos !== undefined) updateData.es_por_grupos = data.es_por_grupos;
      if (data.territorio_ids !== undefined) {
        updateData.territorio_ids = data.territorio_ids;
      } else if (data.territorio_id !== undefined) {
        updateData.territorio_ids = [data.territorio_id];
      }
      if (data.asignaciones_grupos !== undefined) {
        updateData.asignaciones_grupos = JSON.parse(JSON.stringify(data.asignaciones_grupos));
      }
      
      const { error } = await supabase
        .from("programa_predicacion")
        .update(updateData)
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

  // Limpiar programa (múltiples entradas)
  const limpiarPrograma = useMutation({
    mutationFn: async (options: {
      tipo: "todo" | "capitanes" | "territorios" | "puntos";
      ids: string[];
    }) => {
      const { ids, tipo } = options;
      if (ids.length === 0) return;

      if (tipo === "todo") {
        // Marcar como inactivo
        const { error } = await supabase
          .from("programa_predicacion")
          .update({ activo: false })
          .in("id", ids);
        if (error) throw error;
      } else if (tipo === "capitanes") {
        // Solo limpiar capitán
        const { error } = await supabase
          .from("programa_predicacion")
          .update({ capitan_id: null })
          .in("id", ids);
        if (error) throw error;
      } else if (tipo === "territorios") {
        // Solo limpiar territorios
        const { error } = await supabase
          .from("programa_predicacion")
          .update({ territorio_ids: [] })
          .in("id", ids);
        if (error) throw error;
      } else if (tipo === "puntos") {
        // Solo limpiar punto de encuentro
        const { error } = await supabase
          .from("programa_predicacion")
          .update({ punto_encuentro_id: null })
          .in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
      const mensajes = {
        todo: "Programa limpiado completamente",
        capitanes: "Capitanes removidos",
        territorios: "Territorios removidos",
        puntos: "Puntos de encuentro removidos",
      };
      toast({ title: mensajes[variables.tipo] });
    },
    onError: () => {
      toast({ title: "Error al limpiar programa", variant: "destructive" });
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
    limpiarPrograma,
  };
}
