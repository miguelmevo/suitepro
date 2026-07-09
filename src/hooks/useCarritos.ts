import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";

export interface CarritoData {
  id: string;
  numero: number;
  ubicacion: string;
  direccion: string | null;
  url_maps: string | null;
  activo: boolean;
}

export function useCarritosActivos() {
  const congregacionId = useCongregacionId();

  const { data: carritos = [] } = useQuery({
    queryKey: ["carritos-activos", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carritos")
        .select("id, numero, ubicacion, direccion, url_maps, activo")
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true)
        .order("numero");
      if (error) throw error;
      return data as CarritoData[];
    },
    enabled: !!congregacionId,
  });

  return carritos;
}
