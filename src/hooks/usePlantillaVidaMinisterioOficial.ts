import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PlantillaVyMOficial {
  id: string;
  fecha_semana: string;
  idioma: string;
  url_origen: string | null;
  lectura_semana: string | null;
  cantico_inicial: number | null;
  cantico_intermedio: number | null;
  cantico_final: number | null;
  tesoros: { titulo?: string; duracion?: number | null; detalle?: string | null };
  perlas: { titulo?: string; duracion?: number | null };
  lectura_biblica: { cita?: string; duracion?: number | null; leccion?: string | null };
  maestros: Array<{ titulo: string; tipo: "demostracion" | "discurso"; duracion?: number | null; leccion?: string | null; detalle?: string | null }>;
  vida_cristiana: Array<{ titulo: string; duracion?: number | null; detalle?: string | null }>;
  estudio_biblico: { duracion?: number | null };
  importado_por: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlantillaVidaMinisterioOficial(fechaSemana: string | null) {
  return useQuery({
    queryKey: ["plantilla-vym-oficial", fechaSemana],
    queryFn: async (): Promise<PlantillaVyMOficial | null> => {
      if (!fechaSemana) return null;
      const { data, error } = await supabase
        .from("plantillas_vida_ministerio_oficial" as any)
        .select("*")
        .eq("fecha_semana", fechaSemana)
        .eq("idioma", "es")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PlantillaVyMOficial) ?? null;
    },
    enabled: !!fechaSemana,
    staleTime: 1000 * 60 * 30,
  });
}

export function useListadoPlantillasVyMOficial() {
  return useQuery({
    queryKey: ["plantilla-vym-oficial", "lista"],
    queryFn: async (): Promise<PlantillaVyMOficial[]> => {
      const { data, error } = await supabase
        .from("plantillas_vida_ministerio_oficial" as any)
        .select("*")
        .order("fecha_semana", { ascending: false });
      if (error) throw error;
      return (data as unknown as PlantillaVyMOficial[]) ?? [];
    },
  });
}

export interface ImportarItem {
  url: string;
  fecha_semana?: string | null; // YYYY-MM-DD opcional (lunes de la semana)
  forzar_fecha_url?: boolean; // true => ignora fecha_semana y usa la de JW.ORG
}

export interface ResultadoImportacion {
  url: string;
  fecha_semana: string | null;
  estado: string;
  mensaje: string;
  fecha_manual?: string | null;
  fecha_jw?: string | null;
}

export function useImportarPlantillasVyM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: ImportarItem[]) => {
      const { data, error } = await supabase.functions.invoke("importar-vym-wol", {
        body: { items },
      });
      if (error) throw error;
      return data as { ok: boolean; resultados: ResultadoImportacion[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantilla-vym-oficial"] });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Error al importar plantillas");
    },
  });
}


export function useEliminarPlantillaVyM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plantillas_vida_ministerio_oficial" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plantilla eliminada");
      qc.invalidateQueries({ queryKey: ["plantilla-vym-oficial"] });
    },
    onError: (e: Error) => toast.error(e.message || "Error al eliminar"),
  });
}
