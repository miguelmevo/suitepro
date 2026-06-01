import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Map, Loader2, ChevronRight, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCongregacionBySlug } from "@/hooks/useCongregacionBySlug";
import { useAuthContext } from "@/contexts/AuthProvider";

interface TerritorioListItem {
  id: string;
  numero: string;
  nombre: string | null;
}

export default function TerritoriosPublico() {
  const navigate = useNavigate();
  const { user, userCongregaciones } = useAuthContext();
  const { congregacion: congFromSlug, isLoading: slugLoading } = useCongregacionBySlug();

  // Determinar congregación: 1) ?slug=  2) congregación principal del usuario logueado
  const userCongregacionId =
    userCongregaciones.find((c) => c.es_principal)?.congregacion_id ||
    userCongregaciones[0]?.congregacion_id ||
    null;

  const congregacionId = congFromSlug?.id || userCongregacionId || null;

  const { data: territorios = [], isLoading } = useQuery({
    queryKey: ["territorios-publicos", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];
      const { data, error } = await supabase.rpc("get_territorios_publicos", {
        _congregacion_id: congregacionId,
      });
      if (error) throw error;
      return (data || []) as TerritorioListItem[];
    },
    enabled: !!congregacionId,
  });

  if (slugLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Map className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Territorios</h1>
        </div>

        {!congregacionId ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Para ver los territorios, accede desde el enlace de tu congregación
              (por ejemplo <code>?slug=tucongregacion</code>) o inicia sesión.
            </AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : territorios.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay territorios disponibles.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {territorios.length} territorio{territorios.length === 1 ? "" : "s"} disponible{territorios.length === 1 ? "" : "s"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {territorios.map((t) => (
                  <li key={t.id}>
                    <Button
                      variant="ghost"
                      className="w-full justify-between rounded-none h-auto py-3 px-4"
                      onClick={() => navigate(`/territorio/${t.id}`)}
                    >
                      <span className="flex items-center gap-3 text-left">
                        <span className="font-bold text-primary text-lg w-10">
                          {t.numero}
                        </span>
                        {t.nombre && (
                          <span className="text-sm text-muted-foreground truncate">
                            {t.nombre}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
