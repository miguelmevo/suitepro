import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConfiguracionItem {
  id: string;
  programa_tipo: string;
  clave: string;
  valor: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useConfiguracionSistema(programaTipo?: string) {
  const queryClient = useQueryClient();

  const { data: configuraciones, isLoading } = useQuery({
    queryKey: ["configuracion-sistema", programaTipo],
    queryFn: async () => {
      let query = supabase
        .from("configuracion_sistema")
        .select("*");
      
      if (programaTipo) {
        query = query.eq("programa_tipo", programaTipo);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ConfiguracionItem[];
    },
  });

  const actualizarConfiguracion = useMutation({
    mutationFn: async ({ 
      programaTipo, 
      clave, 
      valor 
    }: { 
      programaTipo: string; 
      clave: string; 
      valor: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from("configuracion_sistema")
        .upsert(
          { programa_tipo: programaTipo, clave, valor },
          { onConflict: "programa_tipo,clave" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracion-sistema"] });
      toast.success("Configuración guardada");
    },
    onError: (error) => {
      console.error("Error al guardar configuración:", error);
      toast.error("Error al guardar la configuración");
    },
  });

  const getConfigValue = (clave: string): Record<string, any> | undefined => {
    const config = configuraciones?.find((c) => c.clave === clave);
    return config?.valor;
  };

  return {
    configuraciones,
    isLoading,
    actualizarConfiguracion,
    getConfigValue,
  };
}
