import { useState, useMemo, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wrench,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Video,
  Monitor,
  Presentation,
  Mic,
  DoorOpen,
  Armchair,
  Sparkles,
  Coffee,
  Share2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { TIPOS_ASIGNACION_SERVICIO } from "@/hooks/useAsignacionesServicio";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type IconCfg = { icon: typeof Mic; color: string; label?: string };

const ICONS_POR_TIPO: Record<string, IconCfg> = {
  audio: { icon: Volume2, color: "text-sky-600" },
  video: { icon: Video, color: "text-violet-600" },
  zoom: { icon: Monitor, color: "text-blue-600" },
  plataforma: { icon: Presentation, color: "text-indigo-600" },
  pasillo_1: { icon: Mic, color: "text-emerald-600", label: "Mic. Pasillo" },
  pasillo_2: { icon: Mic, color: "text-emerald-600", label: "Mic. Pasillo" },
  acomodador_auditorio: { icon: Armchair, color: "text-amber-600", label: "Auditorio" },
  acomodador_entrada_1: { icon: DoorOpen, color: "text-orange-600", label: "Entrada" },
  acomodador_entrada_2: { icon: DoorOpen, color: "text-orange-600", label: "Entrada" },
  aseo_1: { icon: Sparkles, color: "text-teal-600", label: "Aseo Salón" },
  aseo_2: { icon: Sparkles, color: "text-teal-600", label: "Aseo Salón" },
  hospitalidad: { icon: Coffee, color: "text-rose-600", label: "Hospitalidad" },
};

const BLOQUES: { label: string; tipos: string[] }[] = [
  { label: "Audiovisual", tipos: ["audio", "video", "zoom", "plataforma", "pasillo_1", "pasillo_2"] },
  { label: "Acomodadores", tipos: ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"] },
  { label: "Aseo", tipos: ["aseo_1", "aseo_2"] },
  { label: "Hospitalidad", tipos: ["hospitalidad"] },
];

export function AsignacionesServicioSemanal() {
  const congregacionId = useCongregacionId();
  const hoyStr = format(new Date(), "yyyy-MM-dd");
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const { participantes, isLoading: loadingPart } = useParticipantes();
  const { grupos = [], isLoading: loadingGrupos } = useGruposPredicacion();

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
    return grupos.find((x: any) => x.id === id) || null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg uppercase">
            <Wrench className="h-5 w-5" strokeWidth={1.75} />
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

  const renderFila = (tipoVal: string, valor: string, sub?: string) => {
    const cfg = ICONS_POR_TIPO[tipoVal];
    if (!cfg) return null;
    const Icon = cfg.icon;
    const tipoMeta = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipoVal);
    const label = cfg.label ?? tipoMeta?.label ?? tipoVal;
    return (
      <div key={tipoVal} className="flex items-start gap-1.5 leading-tight">
        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} strokeWidth={1.75} />
        <div className="flex-1 min-w-0 text-xs">
          <span className="text-muted-foreground">{label}: </span>
          <span>{valor}</span>
          {sub && <div className="text-[11px] text-foreground/90 font-medium">{sub}</div>}
        </div>
      </div>
    );
  };

  const renderBloque = (b: typeof BLOQUES[number]) => {
    const filas: React.ReactNode[] = [];
    b.tipos.forEach((tipoVal) => {
      const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipoVal);
      const a = porTipo.get(tipoVal);
      if (!cfg || !a) return;
      if (cfg.tipoCampo === "individual") {
        const v = getNombre(a.participante_id);
        if (v) filas.push(renderFila(tipoVal, v));
      } else {
        const g: any = getGrupo(a.grupo_predicacion_id);
        if (g) {
          const valor = `Grupo ${g.numero}`;
          const responsables: string[] = [];
          if (g.superintendente) responsables.push(`${g.superintendente.nombre} ${g.superintendente.apellido}`);
          if (g.auxiliar) responsables.push(`${g.auxiliar.nombre} ${g.auxiliar.apellido}`);
          filas.push(renderFila(tipoVal, valor, responsables.join(" · ") || undefined));
        }
      }
    });
    if (filas.length === 0) return null;
    return (
      <div key={b.label} className="space-y-2">
        <div className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">
          {b.label}
        </div>
        <div className="space-y-2">{filas}</div>
      </div>
    );
  };

  // Reorganizar en 2 columnas: izquierda [Audiovisual, Aseo], derecha [Acomodadores, Hospitalidad]
  const colIzq = [BLOQUES[0], BLOQUES[2]];
  const colDer = [BLOQUES[1], BLOQUES[3]];

  const handleShare = async () => {
    if (!shareRef.current || !date) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(shareRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `asignaciones-${format(date, "yyyy-MM-dd")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Asignaciones de Servicio",
          text: `Asignaciones del ${format(date, "EEEE d 'de' MMMM", { locale: es })}`,
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = fileName;
        a.click();
        toast.success("Imagen descargada. Adjúntala en WhatsApp.");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast.error("No se pudo generar la imagen");
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-lg uppercase">
          <span className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" strokeWidth={1.75} />
            Asignaciones de Servicio
          </span>
          {date && itemsDia.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs normal-case"
              onClick={handleShare}
              disabled={sharing}
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartir
            </Button>
          )}
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
          <div ref={shareRef} className="bg-background p-3 space-y-2">
            <div className="text-center pb-2 border-b border-border">
              <div className="text-[11px] font-semibold uppercase text-primary tracking-wide">
                Asignaciones de Servicio
              </div>
              {date && (
                <div className="text-sm font-bold uppercase mt-0.5">
                  {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
                </div>
              )}
            </div>
            <div className={`border rounded-lg p-3 ${esHoy ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="space-y-4 pr-4">
                  {colIzq.map((b) => renderBloque(b))}
                </div>
                <div className="space-y-4 pl-4">
                  {colDer.map((b) => renderBloque(b))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
