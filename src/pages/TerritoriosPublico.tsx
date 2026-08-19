import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Map, Loader2, ChevronRight, AlertCircle, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCongregacionBySlug } from "@/hooks/useCongregacionBySlug";
import { useAuthContext } from "@/contexts/AuthProvider";
import { BottomNavPage } from "@/components/layout/BottomNavPage";
import { TerritorioFicha } from "@/components/territorios/TerritorioFicha";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface TerritorioListItem {
  id: string;
  numero: string;
  nombre: string | null;
}

/**
 * @param embedded true cuando se renderiza dentro de AppLayout (con sesión):
 * ahí el layout ya aporta padding y scroll, así que no se envuelve en
 * BottomNavPage, que además fuerza alto completo.
 */
export default function TerritoriosPublico({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // En escritorio la ruta puede traer el territorio abierto (/territorios/:id).
  const { territorioId: seleccionadoId } = useParams<{ territorioId: string }>();
  const { userCongregaciones } = useAuthContext();
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

  // En móvil se navega a la página completa; en escritorio la ficha se abre al
  // lado, actualizando la URL para que el enlace siga siendo compartible.
  const abrirTerritorio = (id: string) =>
    navigate(isMobile ? `/territorio/${id}` : `/territorios/${id}`);

  const encabezado = (
    <div className="flex items-center gap-2">
      <Map className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Territorios</h1>
    </div>
  );

  const listado = !congregacionId ? (
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
                className={cn(
                  "w-full justify-between rounded-none h-auto py-3 px-5",
                  t.id === seleccionadoId && "bg-primary/10 hover:bg-primary/15",
                )}
                onClick={() => abrirTerritorio(t.id)}
              >
                <span className="flex items-center gap-3 text-left min-w-0">
                  <span className="font-bold text-primary text-lg w-10 shrink-0">
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
  );

  // Envoltorio: dentro del layout basta un contenedor simple; suelta (sin
  // sesión) necesita BottomNavPage para dejar lugar a la barra inferior.
  const Envoltorio = ({ children, ancho }: { children: React.ReactNode; ancho?: string }) =>
    embedded ? (
      // Alto anclado a la pantalla: el layout de escritorio usa min-h-screen, así
      // que sus hijos no tienen alto definido y un h-full acá no resolvería.
      // Se descuenta el header (~3rem) y el padding del contenido (p-6 = 3rem).
      <div className={cn("h-[calc(100vh-6rem)] flex flex-col gap-4 min-h-0", ancho)}>{children}</div>
    ) : (
      <BottomNavPage className="px-6 py-4" contentClassName={cn("space-y-4", ancho)}>
        {children}
      </BottomNavPage>
    );

  // Móvil: sólo el listado, la ficha vive en su propia página.
  if (isMobile) {
    return (
      <Envoltorio ancho="max-w-2xl mx-auto">
        {encabezado}
        {listado}
      </Envoltorio>
    );
  }

  // Escritorio: lista fija a la izquierda y ficha al lado, para poder saltar de
  // un territorio a otro sin volver atrás.
  return (
    <Envoltorio>
      <div className="shrink-0">{encabezado}</div>
      <div
        className={cn(
          "flex gap-4",
          // Embebido reparte el alto disponible entre ambas columnas; suelto
          // (sin sesión) no hay alto definido, así que se acota al viewport.
          embedded ? "flex-1 min-h-0" : "items-start max-h-[calc(100vh-10rem)]",
        )}
      >
        <div className="w-[300px] shrink-0 h-full overflow-y-auto">
          {listado}
        </div>
        <div className="flex-1 min-w-0 h-full">
          {seleccionadoId ? (
            <TerritorioFicha key={seleccionadoId} territorioId={seleccionadoId} ajustarAlto />
          ) : (
            <Card className="border-dashed h-full flex items-center justify-center">
              <CardContent className="py-20 text-center text-muted-foreground">
                <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Elige un territorio de la lista para ver su mapa y sus manzanas.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Envoltorio>
  );
}
