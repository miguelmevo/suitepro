import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Ban, AlertCircle, MapPin, Loader2, ClipboardList, ChevronDown, LogIn, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RegistroManzanasTrabajadas } from "@/components/territorios/RegistroManzanasTrabajadas";

interface Territorio {
  id: string;
  numero: string;
  nombre: string | null;
  imagen_url: string | null;
  url_maps: string | null;
  congregacion_id: string;
}

interface DireccionBloqueada {
  id: string;
  direccion: string;
  motivo: string | null;
}

interface ManzanaTerritorio {
  id: string;
  letra: string;
}

export default function TerritorioDetalle() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { territorioId } = useParams<{ territorioId: string }>();
  const [registroOpen, setRegistroOpen] = useState(false);

  // Check if user is authenticated and is a captain
  const { data: session } = useQuery({
    queryKey: ["session-check"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const isAuthenticated = !!session?.user;

  const { data: territorio, isLoading: loadingTerritorio, error: errorTerritorio } = useQuery({
    queryKey: ['territorio-detalle', territorioId],
    queryFn: async () => {
      if (!territorioId) throw new Error('No se especificó territorio');
      const { data, error } = await supabase
        .rpc('get_territorio_publico', { _territorio_id: territorioId });
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Territorio no encontrado');
      return data[0] as Territorio;
    },
    enabled: !!territorioId,
  });

  const { data: puedeRegistrarManzanas = false } = useQuery({
    queryKey: ["puede-registrar-manzanas", session?.user?.id, territorio?.congregacion_id],
    queryFn: async () => {
      const congId = territorio!.congregacion_id;
      
      // Check if user is admin/editor/super_admin
      const { data: isAdmin } = await supabase
        .rpc("is_admin_or_editor_in_congregacion", { _congregacion_id: congId });
      if (isAdmin) return true;

      // Check if captain
      const { data: isCap } = await supabase
        .rpc("is_capitan_in_congregacion", { _congregacion_id: congId });
      return !!isCap;
    },
    enabled: isAuthenticated && !!territorio?.congregacion_id,
  });


  const { data: manzanas = [] } = useQuery({
    queryKey: ['manzanas-territorio-detalle', territorioId],
    queryFn: async () => {
      if (!territorioId) return [];
      const { data, error } = await supabase
        .rpc('get_manzanas_territorio_publico', { _territorio_id: territorioId });
      if (error) throw error;
      return (data || []) as ManzanaTerritorio[];
    },
    enabled: !!territorioId,
  });

  const { data: direccionesBloqueadas = [] } = useQuery({
    queryKey: ['direcciones-bloqueadas-detalle', territorioId],
    queryFn: async () => {
      if (!territorioId) return [];
      const { data, error } = await supabase
        .rpc('get_direcciones_bloqueadas_publico', { _territorio_id: territorioId });
      if (error) throw error;
      return (data || []) as DireccionBloqueada[];
    },
    enabled: !!territorioId,
  });

  // Public: get worked blocks for active cycle
  const { data: manzanasTrabajadas = [] } = useQuery({
    queryKey: ['manzanas-trabajadas-publico', territorioId],
    queryFn: async () => {
      if (!territorioId) return [];
      const { data, error } = await supabase
        .rpc('get_manzanas_trabajadas_ciclo_activo', { _territorio_id: territorioId });
      if (error) throw error;
      return (data || []) as { manzana_id: string; letra: string; fecha_trabajada: string }[];
    },
    enabled: !!territorioId,
    refetchInterval: 15000,
  });

  // Compute unworked blocks
  const letrasTrabajadas = new Set(manzanasTrabajadas.map(m => m.manzana_id));
  const manzanasNoTrabajadas = manzanas.filter(m => !letrasTrabajadas.has(m.id));

  if (loadingTerritorio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errorTerritorio || !territorio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Territorio no encontrado</h2>
            <p className="text-muted-foreground">
              El territorio solicitado no existe o no está disponible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 -ml-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        )}
        {/* Header */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              Territorio {territorio.numero}
            </CardTitle>
            {territorio.nombre && (
              <p className="text-muted-foreground">{territorio.nombre}</p>
            )}
          </CardHeader>
          <CardContent>
            {territorio.url_maps && (
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <a href={territorio.url_maps} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver en Google Maps
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Captain message + unworked blocks (always visible) */}
        {manzanas.length > 0 && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Alert className="bg-primary/10 border-primary/30">
                <AlertCircle className="h-5 w-5 text-primary" />
                <AlertDescription className="text-base">
                  <strong>Capitán:</strong> Recuerda informar las manzanas trabajadas
                </AlertDescription>
              </Alert>

              {/* Unworked blocks - public */}
              {manzanasNoTrabajadas.length > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Manzanas no trabajadas:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {manzanasNoTrabajadas.map(m => (
                      <Badge key={m.id} variant="outline" className="text-sm">
                        {m.letra}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ✅ Todas las manzanas han sido trabajadas en este ciclo.
                </p>
              )}

              {/* Register button */}
              {isAuthenticated && puedeRegistrarManzanas ? (
                <Collapsible open={registroOpen} onOpenChange={setRegistroOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="default" size="sm" className="gap-1 w-full sm:w-auto">
                      <ClipboardList className="h-4 w-4" />
                      Registrar manzanas trabajadas
                      <ChevronDown className={`h-3 w-3 transition-transform ${registroOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3">
                      <RegistroManzanasTrabajadas
                        territorioId={territorio.id}
                        congregacionId={territorio.congregacion_id}
                        manzanas={manzanas}
                        onClose={() => setRegistroOpen(false)}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : !isAuthenticated ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 w-full sm:w-auto"
                  onClick={() => navigate("/auth")}
                >
                  <LogIn className="h-4 w-4" />
                  Iniciar sesión para registrar
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Territory image */}
        {territorio.imagen_url && (
          <Card>
            <CardContent className="p-2">
              <img 
                src={territorio.imagen_url} 
                alt={`Mapa del Territorio ${territorio.numero}`}
                className="w-full rounded-lg"
              />
            </CardContent>
          </Card>
        )}

        {/* Blocked addresses */}
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" />
              No Pasar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {direccionesBloqueadas.length > 0 ? (
              <ul className="space-y-3">
                {direccionesBloqueadas.map((dir) => (
                  <li key={dir.id} className="border-l-2 border-destructive pl-3 py-1">
                    <span className="font-medium">{dir.direccion}</span>
                    {dir.motivo && (
                      <p className="text-sm text-muted-foreground mt-0.5">{dir.motivo}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-4 text-center text-muted-foreground">
                <Ban className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No hay direcciones bloqueadas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
