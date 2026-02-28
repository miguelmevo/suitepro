import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Ban, AlertCircle, MapPin, Loader2, ClipboardList, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const { data: esCapitan = false } = useQuery({
    queryKey: ["es-capitan-check", session?.user?.id],
    queryFn: async () => {
      // Check if the user's linked participante has es_capitan_grupo = true
      const { data, error } = await supabase
        .from("usuarios_congregacion")
        .select("participante_id")
        .eq("user_id", session!.user.id)
        .eq("activo", true)
        .maybeSingle();
      
      if (error || !data?.participante_id) return false;

      const { data: participante, error: pError } = await supabase
        .from("participantes")
        .select("es_capitan_grupo")
        .eq("id", data.participante_id)
        .eq("activo", true)
        .maybeSingle();
      
      if (pError || !participante) return false;
      return participante.es_capitan_grupo;
    },
    enabled: isAuthenticated,
  });

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

        {/* Captain message + registration */}
        {manzanas.length > 0 && isAuthenticated && esCapitan && (
          <Collapsible open={registroOpen} onOpenChange={setRegistroOpen}>
            <Alert className="bg-primary/10 border-primary/30">
              <AlertCircle className="h-5 w-5 text-primary" />
              <AlertDescription className="text-base flex items-center justify-between">
                <span>
                  <strong>Capitán:</strong> Recuerda informar las manzanas trabajadas
                </span>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 ml-2">
                    <ClipboardList className="h-4 w-4" />
                    <span className="hidden sm:inline">Registrar</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${registroOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
              </AlertDescription>
            </Alert>
            <CollapsibleContent>
              <Card className="mt-2 border-primary/20">
                <CardContent className="pt-4">
                  <RegistroManzanasTrabajadas
                    territorioId={territorio.id}
                    congregacionId={territorio.congregacion_id}
                    manzanas={manzanas}
                  />
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Non-captain message */}
        {manzanas.length > 0 && (!isAuthenticated || !esCapitan) && (
          <Alert className="bg-primary/10 border-primary/30">
            <AlertCircle className="h-5 w-5 text-primary" />
            <AlertDescription className="text-base">
              <strong>Capitán:</strong> Recuerda informar las manzanas trabajadas
            </AlertDescription>
          </Alert>
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
