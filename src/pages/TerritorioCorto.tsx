import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Enlace corto a un territorio: /t/<código público de la congregación>/<número>.
 * Busca el territorio por su número y redirige a su ficha (/territorio/:id).
 * Es el enlace que lleva el mensaje de WhatsApp de la ficha.
 */
export default function TerritorioCorto() {
  const { codigo, numero } = useParams<{ codigo: string; numero: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["territorio-corto", codigo, numero],
    queryFn: async () => {
      const { data: cong, error } = await supabase.rpc("get_congregacion_by_codigo", { _codigo: codigo! });
      if (error) throw error;
      const congId = (cong as { id: string }[] | null)?.[0]?.id;
      if (!congId) return null;
      const { data: lista, error: e2 } = await supabase.rpc("get_territorios_publicos", { _congregacion_id: congId });
      if (e2) throw e2;
      return (lista ?? []).find((t) => t.numero === numero)?.id ?? null;
    },
    enabled: !!codigo && !!numero,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return <Navigate to={data ? `/territorio/${data}` : "/territorios"} replace />;
}
