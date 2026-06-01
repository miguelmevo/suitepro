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
  audio: { icon: Volume2, color: "text-sky-600", label: "Audio" },
  video: { icon: Video, color: "text-violet-600", label: "Video" },
  zoom: { icon: Monitor, color: "text-blue-600", label: "Zoom" },
  plataforma: { icon: Presentation, color: "text-indigo-600", label: "Plataforma" },
  pasillo_1: { icon: Mic, color: "text-emerald-600", label: "Pasillo" },
  pasillo_2: { icon: Mic, color: "text-emerald-600", label: "Pasillo" },
  acomodador_auditorio: { icon: Armchair, color: "text-amber-600", label: "Auditorio" },
  acomodador_entrada_1: { icon: DoorOpen, color: "text-orange-600", label: "Entrada" },
  acomodador_entrada_2: { icon: DoorOpen, color: "text-orange-600", label: "Entrada" },
  aseo_1: { icon: Sparkles, color: "text-teal-600" },
  aseo_2: { icon: Sparkles, color: "text-teal-600" },
  hospitalidad: { icon: Coffee, color: "text-rose-600" },
};

const BLOQUES: { label: string; tipos: string[] }[] = [
  { label: "Audio / Video", tipos: ["audio", "video", "zoom"] },
  { label: "Micrófonos", tipos: ["plataforma", "pasillo_1", "pasillo_2"] },
  { label: "Acomodación", tipos: ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"] },
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

  const renderFila = (tipoVal: string, labelOverride: string | null, valor: string, extraKey?: string) => {
    const cfg = ICONS_POR_TIPO[tipoVal];
    const tipoMeta = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipoVal);
    const label = labelOverride ?? cfg?.label ?? tipoMeta?.label ?? tipoVal;
    const IconComp = cfg?.icon;
    const key = extraKey ? `${tipoVal}-${extraKey}` : tipoVal + valor;
    return (
      <div key={key} className="flex items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-1.5">
          {IconComp && <IconComp className={`h-3.5 w-3.5 ${cfg.color}`} strokeWidth={2} />}
          <span className="font-semibold text-foreground/90 shrink-0">{label}:</span>
        </div>
        <span className="text-right text-foreground">{valor}</span>
      </div>
    );
  };

  const renderBloque = (b: typeof BLOQUES[number]) => {
    const filas: React.ReactNode[] = [];

    if (b.label === "Aseo") {
      // Recopilar todos los nombres (SG y AX) de todos los grupos de aseo en una sola fila
      const nombres: { nombre: string; tipoVal: string; rol: "sg" | "ax" }[] = [];
      b.tipos.forEach((tipoVal) => {
        const a = porTipo.get(tipoVal);
        if (!a) return;
        const g: any = getGrupo(a.grupo_predicacion_id);
        if (!g) return;
        if (g.superintendente) {
          nombres.push({
            nombre: `${g.superintendente.nombre} ${g.superintendente.apellido}`,
            tipoVal,
            rol: "sg",
          });
        }
        if (g.auxiliar) {
          nombres.push({
            nombre: `${g.auxiliar.nombre} ${g.auxiliar.apellido}`,
            tipoVal,
            rol: "ax",
          });
        }
      });
      if (nombres.length > 0) {
        const cfg = ICONS_POR_TIPO["aseo_1"];
        const IconComp = cfg?.icon;
        filas.push(
          <div key="aseo-row" className="flex items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-1.5">
              {IconComp && <IconComp className={`h-3.5 w-3.5 ${cfg.color}`} strokeWidth={2} />}
              <span className="font-semibold text-foreground/90 shrink-0">Aseo:</span>
            </div>
            <div className="flex flex-col items-end text-foreground leading-tight">
              {nombres.map((n, i) => (
                <span key={`${n.tipoVal}-${n.rol}-${i}`}>{n.nombre}</span>
              ))}
            </div>
          </div>
        );
      }
    } else {
      b.tipos.forEach((tipoVal) => {
        const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipoVal);
        const a = porTipo.get(tipoVal);
        if (!cfg || !a) return;
        if (cfg.tipoCampo === "individual") {
          const v = getNombre(a.participante_id);
          if (v) filas.push(renderFila(tipoVal, null, v));
        } else {
          const g: any = getGrupo(a.grupo_predicacion_id);
          if (g) {
            const responsables: string[] = [];
            if (g.superintendente) responsables.push(`${g.superintendente.nombre} ${g.superintendente.apellido}`);
            if (g.auxiliar) responsables.push(`${g.auxiliar.nombre} ${g.auxiliar.apellido}`);
            const valor = responsables.length ? responsables.join(" / ") : `Grupo ${g.numero}`;
            filas.push(renderFila(tipoVal, `G${g.numero}`, valor));
          }
        }
      });
    }

    if (filas.length === 0) return null;
    return (
      <div key={b.label} className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="pb-2 mb-3 border-b border-border/70">
          <div className="text-sm font-bold uppercase tracking-wide text-foreground">
            {b.label}
          </div>
        </div>
        <div className="space-y-2">{filas}</div>
      </div>
    );
  };


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
          <div ref={shareRef} className="bg-background rounded-xl overflow-hidden border border-border">
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-600 text-white px-6 py-5 text-center">
              <div className="text-xl sm:text-2xl font-bold tracking-tight">
                Asignación de Departamentos
              </div>
              {date && (
                <div className="text-sm mt-1 opacity-95">
                  {format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
                    .replace(/(^|\s)\S/g, (l) => l.toUpperCase())}
                </div>
              )}
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BLOQUES.map((b) => renderBloque(b))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
