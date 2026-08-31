import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Ban, AlertCircle, MapPin, Loader2, ClipboardList, ChevronDown, LogIn, History, ArrowLeft, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RegistroManzanasTrabajadas } from "@/components/territorios/RegistroManzanasTrabajadas";
import { HistorialManzanasModal } from "@/components/territorios/HistorialManzanasModal";
import { PinchZoomImage } from "@/components/ui/pinch-zoom-image";
import { cn } from "@/lib/utils";

interface Territorio {
  id: string;
  numero: string;
  nombre: string | null;
  imagen_url: string | null;
  url_maps: string | null;
  congregacion_id: string;
  tiene_manzanas?: boolean;
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

/**
 * Ficha de un territorio: mapa, manzanas no trabajadas, registro e historial y
 * direcciones "No Pasar". Se usa como página completa en móvil y enlaces
 * directos (TerritorioDetalle) y como panel derecho del listado en escritorio.
 */
export function TerritorioFicha({
  territorioId,
  ajustarAlto = false,
}: {
  territorioId: string;
  /** Encaja la ficha en el alto disponible (panel de escritorio): el mapa se
   *  escala para que todo entre en pantalla, en vez de crecer y pedir scroll. */
  ajustarAlto?: boolean;
}) {
  const navigate = useNavigate();
  const [registroOpen, setRegistroOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  // "No Pasar" arranca colapsado sólo en el panel de escritorio (ajustarAlto):
  // ahí compite por espacio con el mapa. En móvil sigue expandido, como está hoy.
  const [noPasarOpen, setNoPasarOpen] = useState(false);
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [planoAmpliado, setPlanoAmpliado] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session-check"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const isAuthenticated = !!session?.user;

  const { data: territorio, isLoading: loadingTerritorio, error: errorTerritorio } = useQuery({
    queryKey: ["territorio-detalle", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_territorio_publico", { _territorio_id: territorioId });
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Territorio no encontrado");
      return data[0] as Territorio;
    },
    enabled: !!territorioId,
  });

  // Imagen con el plano completo de todos los territorios (configurada en
  // Ajustes → Predicación). configuracion_sistema tiene lectura pública, así
  // que esta consulta funciona igual en la ficha pública sin autenticar.
  const { data: planoGeneralUrl } = useQuery({
    queryKey: ["plano-general-territorios", territorio?.congregacion_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracion_sistema")
        .select("valor")
        .eq("congregacion_id", territorio!.congregacion_id)
        .eq("programa_tipo", "predicacion")
        .eq("clave", "plano_general_url")
        .maybeSingle();
      if (error) throw error;
      return ((data?.valor as any)?.url as string | undefined) || null;
    },
    enabled: !!territorio?.congregacion_id,
  });

  const { data: puedeRegistrarManzanas = false } = useQuery({
    queryKey: ["puede-registrar-manzanas", session?.user?.id, territorio?.congregacion_id],
    queryFn: async () => {
      const congId = territorio!.congregacion_id;

      // Mismos criterios que marcar_manzana_trabajada en la base: capitán de
      // grupo, administrador (el editor ya no alcanza) o permiso granular
      // sobre el historial de territorios.
      const { data: isAdmin } = await supabase
        .rpc("is_admin_in_congregacion" as never, { _congregacion_id: congId } as never);
      if (isAdmin) return true;

      const { data: isCap } = await supabase
        .rpc("is_capitan_in_congregacion", { _congregacion_id: congId });
      if (isCap) return true;

      const { data: permisos } = await (supabase.rpc as any)("get_my_permissions", {
        _congregacion_id: congId,
      });
      return ((permisos ?? []) as { modulo: string; puede_crear?: boolean; puede_editar?: boolean }[]).some(
        (p) => p.modulo === "predicacion_territorios_historial" && (p.puede_crear || p.puede_editar),
      );
    },
    enabled: isAuthenticated && !!territorio?.congregacion_id,
  });

  const { data: manzanas = [] } = useQuery({
    queryKey: ["manzanas-territorio-detalle", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_manzanas_territorio_publico", { _territorio_id: territorioId });
      if (error) throw error;
      return (data || []) as ManzanaTerritorio[];
    },
    enabled: !!territorioId,
  });

  const { data: direccionesBloqueadas = [] } = useQuery({
    queryKey: ["direcciones-bloqueadas-detalle", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_direcciones_bloqueadas_publico", { _territorio_id: territorioId });
      if (error) throw error;
      return (data || []) as DireccionBloqueada[];
    },
    enabled: !!territorioId,
  });

  const { data: manzanasTrabajadas = [] } = useQuery({
    queryKey: ["manzanas-trabajadas-publico", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_manzanas_trabajadas_ciclo_activo", { _territorio_id: territorioId });
      if (error) throw error;
      return (data || []) as { manzana_id: string; letra: string; fecha_trabajada: string }[];
    },
    enabled: !!territorioId,
    refetchInterval: 15000,
  });

  const letrasTrabajadas = new Set(manzanasTrabajadas.map((m) => m.manzana_id));
  const manzanasNoTrabajadas = manzanas.filter((m) => !letrasTrabajadas.has(m.id));

  if (loadingTerritorio) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errorTerritorio || !territorio) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Territorio no encontrado</h2>
          <p className="text-muted-foreground">
            El territorio solicitado no existe o no está disponible.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    // El mapa se achica todo lo que haga falta para que la ficha entre sin
    // scroll; overflow-y-auto es sólo la salida de emergencia si el resto del
    // contenido por sí solo ya no cabe.
    <div className={cn(ajustarAlto ? "h-full flex flex-col gap-3 min-h-0 overflow-y-auto" : "space-y-4")}>
      {/* Header. En el panel de escritorio (ajustarAlto) va más compacto: sin
          el bloque del botón de Maps cuando no hay URL (quedaba vacío pero
          ocupando su padding igual) y con menos aire arriba/abajo del título,
          para no desperdiciar el alto que necesita el mapa. */}
      <Card className={cn(ajustarAlto && "shrink-0")}>
        <CardHeader className={cn(ajustarAlto ? "py-3" : "pb-2")}>
          <CardTitle className={cn("flex items-center gap-2", ajustarAlto ? "text-xl" : "text-2xl")}>
            <MapPin className="h-6 w-6 text-primary shrink-0" />
            <span className="truncate">Territorio {territorio.numero}</span>
            <div className="flex items-center gap-1 ml-auto shrink-0">
              {territorio.url_maps && (
                <Button asChild variant="outline" size="icon" className="h-8 w-8" title="Ver en Google Maps">
                  <a href={territorio.url_maps} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {planoGeneralUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto flex-col gap-0.5 px-2 py-1"
                  onClick={() => setPlanoAmpliado(true)}
                >
                  <Map className="h-4 w-4" />
                  <span className="text-[10px] font-normal leading-tight text-center">
                    Ver territorio<br />completo
                  </span>
                </Button>
              )}
            </div>
          </CardTitle>
          {territorio.nombre && (
            <p className="text-muted-foreground">{territorio.nombre}</p>
          )}
        </CardHeader>
      </Card>

      {/* Aviso al capitán + manzanas no trabajadas */}
      {territorio.tiene_manzanas !== false && manzanas.length > 0 && (
        <Card className={cn(ajustarAlto && "shrink-0")}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
              <p>
                <strong>Capitán:</strong> Recuerda informar las manzanas trabajadas
              </p>
            </div>

            {manzanasNoTrabajadas.length > 0 ? (
              <div>
                <p className="text-sm font-medium mb-2">Manzanas no trabajadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {manzanasNoTrabajadas.map((m) => (
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

            {/* Historial público */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1 w-full sm:w-auto border border-border/70 shadow-sm"
              onClick={() => setHistorialOpen(true)}
            >
              <History className="h-4 w-4" />
              Historial de manzanas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Imagen del territorio. Con ajustarAlto toma el espacio sobrante y la
          imagen se escala dentro (object-contain), sin recortarse ni deformarse. */}
      {territorio.imagen_url && (
        <Card className={cn(ajustarAlto && "flex-1 min-h-0 overflow-hidden")}>
          <CardContent className={cn("p-2", ajustarAlto && "h-full flex flex-col gap-2")}>
            <button
              type="button"
              onClick={() => setImagenAmpliada(true)}
              className={cn("block w-full cursor-zoom-in", ajustarAlto ? "flex-1 min-h-0" : "h-full")}
              aria-label="Ampliar imagen del territorio"
            >
              <img
                src={territorio.imagen_url}
                alt={`Mapa del Territorio ${territorio.numero}`}
                className={cn(
                  "rounded-lg",
                  ajustarAlto ? "h-full w-full object-contain" : "w-full",
                )}
              />
            </button>
            {planoGeneralUrl && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 gap-1 shrink-0"
                onClick={() => setPlanoAmpliado(true)}
              >
                <Map className="h-4 w-4" />
                Ver mapa de territorio completo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {imagenAmpliada && territorio.imagen_url && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          <div className="shrink-0 p-3 border-b bg-background">
            <Button variant="outline" onClick={() => setImagenAmpliada(false)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </div>
          <div className="flex-1 min-h-0 p-4">
            <PinchZoomImage
              src={territorio.imagen_url}
              alt={`Mapa del Territorio ${territorio.numero}`}
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {planoAmpliado && planoGeneralUrl && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          <div className="shrink-0 p-3 border-b bg-background">
            <Button variant="outline" onClick={() => setPlanoAmpliado(false)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </div>
          <div className="flex-1 min-h-0 p-4">
            <PinchZoomImage src={planoGeneralUrl} alt="Plano completo de territorios" className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Direcciones bloqueadas. En el panel de escritorio (ajustarAlto) queda
          colapsado por defecto para no competirle espacio al mapa. */}
      {ajustarAlto ? (
        <Card className="border-destructive/50 shrink-0">
          <Collapsible open={noPasarOpen} onOpenChange={setNoPasarOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full text-left">
                <CardHeader className="py-3">
                  <CardTitle className="text-lg text-destructive flex items-center gap-2">
                    <Ban className="h-5 w-5" />
                    No Pasar
                    {direccionesBloqueadas.length === 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        No existen registros
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 ml-auto text-muted-foreground transition-transform",
                        noPasarOpen && "rotate-180",
                      )}
                    />
                  </CardTitle>
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            {direccionesBloqueadas.length > 0 && (
              <CollapsibleContent>
                <CardContent className="pt-0">
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
                </CardContent>
              </CollapsibleContent>
            )}
          </Collapsible>
        </Card>
      ) : (
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
      )}

      <HistorialManzanasModal
        open={historialOpen}
        onOpenChange={setHistorialOpen}
        territorioId={territorio.id}
        territorioLabel={territorio.numero}
      />
    </div>
  );
}
