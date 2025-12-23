import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HorarioSalida, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";

export function useCatalogos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const crearPuntoEncuentro = useMutation({
    mutationFn: async (data: { nombre: string; direccion?: string; url_maps?: string }) => {
      const { error } = await supabase.from("puntos_encuentro").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["puntos-encuentro"] });
      toast({ title: "Punto de encuentro creado" });
    },
    onError: () => {
      toast({ title: "Error al crear punto de encuentro", variant: "destructive" });
    },
  });

  const crearTerritorio = useMutation({
    mutationFn: async (data: { numero: string; nombre?: string; descripcion?: string }) => {
      const { error } = await supabase.from("territorios").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territorios"] });
      toast({ title: "Territorio creado" });
    },
    onError: () => {
      toast({ title: "Error al crear territorio", variant: "destructive" });
    },
  });

  const crearHorario = useMutation({
    mutationFn: async (data: { hora: string; nombre: string; orden?: number }) => {
      const { error } = await supabase.from("horarios_salida").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["horarios-salida"] });
      toast({ title: "Horario creado" });
    },
    onError: () => {
      toast({ title: "Error al crear horario", variant: "destructive" });
    },
  });

  return {
    horarios: horariosQuery.data || [],
    puntos: puntosQuery.data || [],
    territorios: territoriosQuery.data || [],
    isLoading: horariosQuery.isLoading || puntosQuery.isLoading || territoriosQuery.isLoading,
    crearPuntoEncuentro,
    crearTerritorio,
    crearHorario,
  };
}