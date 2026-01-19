import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Ban, AlertCircle, MapPin, Loader2, ClipboardList } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  // Obtener el link de registro de manzanas desde configuración del sistema
  const { data: linkRegistroManzanas } = useQuery({
    queryKey: ['config-link-registro-manzanas', territorio?.congregacion_id],
    queryFn: async () => {
      if (!territorio?.congregacion_id) return null;
      
      const { data, error } = await supabase
        .rpc('get_link_registro_manzanas', { _congregacion_id: territorio.congregacion_id });
      
      if (error) return null;
      return data as string | null;
    },
    enabled: !!territorio?.congregacion_id,
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

  const manzanasTexto = manzanas.map(m => m.letra).join(', ');

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
                <a
                  href={territorio.url_maps}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver en Google Maps
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Mensaje recordatorio para el capitán */}
        {manzanas.length > 0 && (
          <Alert className="bg-primary/10 border-primary/30">
            <AlertCircle className="h-5 w-5 text-primary" />
            <AlertDescription className="text-base">
              <strong>Capitán:</strong> Recuerda informar qué manzanas del territorio {territorio.numero} ({manzanasTexto}) se realizan y terminan en esta salida.
            </AlertDescription>
          </Alert>
        )}

        {/* Imagen del territorio */}
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

        {/* Direcciones bloqueadas - No Pasar */}
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

        {/* OCULTO TEMPORALMENTE - Mensaje para el Capitán - Registro de Manzanas
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-primary flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Capitán del Grupo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Si hoy eres el capitán del grupo no olvides visitar el link indicado abajo para rellenar las manzanas que se trabajaron el día de hoy.
            </p>
            {linkRegistroManzanas ? (
              <Button asChild variant="default" size="sm" className="w-full">
                <a
                  href={linkRegistroManzanas}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Registrar Manzanas Trabajadas
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                El link de registro aún no está configurado
              </p>
            )}
          </CardContent>
        </Card>
        */}
      </div>
    </div>
  );
}
