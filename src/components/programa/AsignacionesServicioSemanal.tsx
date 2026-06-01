import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, ChevronLeft, ChevronRight, Mic, Users, Sparkles, Coffee } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { TIPOS_ASIGNACION_SERVICIO } from "@/hooks/useAsignacionesServicio";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const BLOQUES: { label: string; icon: typeof Mic; tipos: string[] }[] = [
  { label: "Audiovisual", icon: Mic, tipos: ["audio", "video", "zoom", "plataforma", "pasillo_1", "pasillo_2"] },
  { label: "Acomodadores", icon: Users, tipos: ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"] },
  { label: "Aseo", icon: Sparkles, tipos: ["aseo_1", "aseo_2"] },
  { label: "Hospitalidad", icon: Coffee, tipos: ["hospitalidad"] },
];

export function AsignacionesServicioSemanal() {
  const congregacionId = useCongregacionId();
  const hoyStr = format(new Date(), "yyyy-MM-dd");

  const { participantes, isLoading: loadingPart } = useParticipantes();
  const { grupos = [], isLoading: loadingGrupos } = useGruposPredicacion();

  // Cargar fechas con asignaciones en ventana amplia (mes anterior, actual, siguiente)
  const ahora = new Date();
  const desde = format(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1), "yyyy-MM-dd");
  const hasta = format(new Date(ahora.getFullYear(), ahora.getMonth() + 2, 0), "yyyy-MM-dd");

  const { data: asignaciones = [], isLoading: loadingAsig } = useQuery({
    queryKey: ["asig-servicio-card", congregacionId, desde, hasta],
    queryFn: async () => {
      if (!congregacionId) return [];
      const { data, error } = await supabase
        .from("programa_asignaciones_servicio")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!congregacionId,
  });

  const isLoading = loadingPart || loadingGrupos || loadingAsig;

  const fechas = useMemo(() => {
    const s = new Set<string>();
    asignaciones.forEach((a: any) => s.add(a.fecha));
    return Array.from(s).sort();
  }, [asignaciones]);

  const [idx, setIdx] = useState(0);

  // Posicionar en próxima reunión (>= hoy) o última si todas pasaron
  useEffect(() => {
    if (fechas.length === 0) return;
    const proxima = fechas.findIndex((f) => f >= hoyStr);
    setIdx(proxima === -1 ? fechas.length - 1 : proxima);
  }, [fechas.length]);

  const getNombre = (id: string | null) => {
    if (!id) return null;
    const p = participantes.find((x: any) => x.id === id);
    return p ? `${p.nombre} ${p.apellido}` : null;
  };
  const getGrupo = (id: string | null) => {
    if (!id) return null;
    const g = grupos.find((x: any) => x.id === id);
    return g ? `Grupo ${g.numero}` : null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg uppercase">
            <Wrench className="h-5 w-5" />
            Asignaciones de Servicio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const fechaActual = fechas[idx];
  const itemsDia = fechaActual ? asignaciones.filter((a: any) => a.fecha === fechaActual) : [];
  const porTipo = new Map<string, any>();
  itemsDia.forEach((a) => porTipo.set(a.tipo_asignacion, a));
  const date = fechaActual ? parseISO(fechaActual) : null;
  const esHoy = fechaActual === hoyStr;

  const renderBloque = (b: typeof BLOQUES[number]) => {
    const filas = b.tipos
      .map((tipoVal) => {
        const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipoVal);
        const a = porTipo.get(tipoVal);
        if (!cfg || !a) return null;
        const valor = cfg.tipoCampo === "individual"
          ? getNombre(a.participante_id)
          : getGrupo(a.grupo_predicacion_id);
        if (!valor) return null;
        const label = tipoVal.startsWith("aseo_") ? "Aseo Salón" : cfg.label;
        return { label, valor };
      })
      .filter(Boolean) as { label: string; valor: string }[];
    if (filas.length === 0) return null;
    const Icon = b.icon;
    return (
      <div key={b.label} className="space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">
          <Icon className="h-3 w-3" strokeWidth={1.75} />
          {b.label}
        </div>
        <div className="space-y-0.5 text-xs">
          {filas.map((f, i) => (
            <div key={i} className="leading-tight">
              <span className="text-muted-foreground">{f.label}: </span>
              <span>{f.valor}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg uppercase">
          <Wrench className="h-5 w-5 text-primary" strokeWidth={1.75} />
          Asignaciones de Servicio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIdx((p) => Math.max(0, p - 1))}
            disabled={idx <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            {date ? (
              <>
                <div className={`text-sm font-bold uppercase ${esHoy ? "text-primary" : ""}`}>
                  {format(date, "EEEE d 'de' MMMM", { locale: es })}
                </div>
                {esHoy && (
                  <span className="inline-block mt-0.5 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Hoy
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Sin reuniones</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIdx((p) => Math.min(fechas.length - 1, p + 1))}
            disabled={idx >= fechas.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {itemsDia.length === 0 ? (
          <div className="text-sm text-center py-2 text-muted-foreground">
            Sin asignaciones
          </div>
        ) : (
          <div className={`border rounded-lg p-3 ${esHoy ? "border-primary bg-primary/5" : "border-border"}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {BLOQUES.map((b) => renderBloque(b))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
