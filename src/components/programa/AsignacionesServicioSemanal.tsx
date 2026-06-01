import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, parseISO, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { TIPOS_ASIGNACION_SERVICIO } from "@/hooks/useAsignacionesServicio";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const GRUPOS_ORDEN: { label: string; tipos: string[] }[] = [
  { label: "Audiovisual", tipos: ["audio", "video", "zoom", "plataforma", "pasillo_1", "pasillo_2"] },
  { label: "Acomodadores", tipos: ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"] },
  { label: "Aseo / Hospitalidad", tipos: ["aseo_1", "aseo_2", "hospitalidad"] },
];

export function AsignacionesServicioSemanal() {
  const [semanaOffset, setSemanaOffset] = useState(0);
  const congregacionId = useCongregacionId();
  const hoy = new Date();
  const semanaBase = semanaOffset === 0 ? hoy : addWeeks(hoy, semanaOffset);
  const inicioSemana = startOfWeek(semanaBase, { weekStartsOn: 1 });
  const finSemana = endOfWeek(semanaBase, { weekStartsOn: 1 });
  const inicioStr = format(inicioSemana, "yyyy-MM-dd");
  const finStr = format(finSemana, "yyyy-MM-dd");

  const { participantes, isLoading: loadingPart } = useParticipantes();
  const { grupos = [], isLoading: loadingGrupos } = useGruposPredicacion();

  const { data: asignaciones = [], isLoading: loadingAsig } = useQuery({
    queryKey: ["asig-servicio-semanal", congregacionId, inicioStr, finStr],
    queryFn: async () => {
      if (!congregacionId) return [];
      const { data, error } = await supabase
        .from("programa_asignaciones_servicio")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gte("fecha", inicioStr)
        .lte("fecha", finStr)
        .order("fecha", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!congregacionId,
  });

  const isLoading = loadingPart || loadingGrupos || loadingAsig;

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

  const porFecha = useMemo(() => {
    const m = new Map<string, any[]>();
    asignaciones.forEach((a: any) => {
      if (!m.has(a.fecha)) m.set(a.fecha, []);
      m.get(a.fecha)!.push(a);
    });
    return m;
  }, [asignaciones]);

  const fechasOrdenadas = Array.from(porFecha.keys()).sort();

  const rangoLabel = inicioSemana.getMonth() === finSemana.getMonth()
    ? `${format(inicioSemana, "d")} – ${format(finSemana, "d 'de' MMMM", { locale: es })}`
    : `${format(inicioSemana, "d 'de' MMM", { locale: es })} – ${format(finSemana, "d 'de' MMM", { locale: es })}`;

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
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg uppercase">
          <Wrench className="h-5 w-5 text-primary" />
          Asignaciones de Servicio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSemanaOffset((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            className="text-sm font-medium lowercase hover:text-primary transition-colors"
            onClick={() => setSemanaOffset(0)}
            title="Volver a la semana actual"
          >
            {rangoLabel}
            {semanaOffset !== 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">(ir a hoy)</span>
            )}
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSemanaOffset((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {fechasOrdenadas.length === 0 ? (
          <div className="text-sm text-center py-2 text-muted-foreground">
            Sin asignaciones esta semana
          </div>
        ) : (
          fechasOrdenadas.map((fecha) => {
            const date = parseISO(fecha);
            const esHoy = format(hoy, "yyyy-MM-dd") === fecha;
            const items = porFecha.get(fecha)!;
            const porTipo = new Map<string, any>();
            items.forEach((a) => porTipo.set(a.tipo_asignacion, a));

            return (
              <div
                key={fecha}
                className={`border rounded-lg p-3 ${esHoy ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-bold uppercase ${esHoy ? "text-primary" : ""}`}>
                    {format(date, "EEEE", { locale: es })}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {format(date, "d 'de' MMMM", { locale: es })}
                  </span>
                  {esHoy && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Hoy
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  {GRUPOS_ORDEN.map((g) => {
                    const filas = g.tipos
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
                    return (
                      <div key={g.label}>
                        <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mb-0.5">
                          {g.label}
                        </div>
                        <div className="space-y-0.5">
                          {filas.map((f, i) => (
                            <div key={i} className="flex items-baseline gap-1.5">
                              <span className="text-muted-foreground">{f.label}:</span>
                              <span>{f.valor}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
