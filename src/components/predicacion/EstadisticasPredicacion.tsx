import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, ChevronDown, ChevronUp, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AsignacionGrupo } from "@/types/programa-predicacion";

interface CountMap { [id: string]: number; }

const MES_COLORS = ["#185FA5", "#0F6E56", "#854F0B"];
const MES_BG    = ["bg-blue-100",  "bg-teal-100",  "bg-amber-100"];
const MES_TEXT  = ["text-blue-800","text-teal-800","text-amber-800"];

function isWeekend(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function HorizontalBar({ label, values, max, meses }: {
  label: string; values: number[]; max: number; meses: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium truncate" title={label}>{label}</div>
      {values.map((val, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 truncate shrink-0">{meses[i]}</span>
          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-1"
              style={{
                width: max > 0 ? `${(val / max) * 100}%` : "0%",
                backgroundColor: MES_COLORS[i],
                minWidth: val > 0 ? "1.5rem" : "0",
              }}
            >
              {val > 0 && <span className="text-white text-xs font-bold">{val}</span>}
            </div>
          </div>
          {val === 0 && <span className="text-xs text-muted-foreground">0</span>}
        </div>
      ))}
    </div>
  );
}

function TrendIcon({ diff }: { diff: number }) {
  if (diff > 0) return <ChevronUp className="h-4 w-4 text-green-600 inline" />;
  if (diff < 0) return <ChevronDown className="h-4 w-4 text-red-500 inline" />;
  return <Minus className="h-4 w-4 text-muted-foreground inline" />;
}

function StatsSet({
  label,
  conteosPorMes,
  selectedMeses,
  participanteMap,
  puntoMap,
  territorioMap,
}: {
  label: string;
  conteosPorMes: { capitanes: CountMap; puntos: CountMap; territorios: CountMap }[];
  selectedMeses: { inicio: string; labelCorto: string }[];
  participanteMap: Record<string, string>;
  puntoMap: Record<string, string>;
  territorioMap: Record<string, string>;
}) {
  function topIds(maps: CountMap[], limit = 15) {
    const allIds = new Set(maps.flatMap((m) => Object.keys(m)));
    return [...allIds]
      .map((id) => ({ id, total: maps.reduce((s, m) => s + (m[id] || 0), 0) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map((x) => x.id);
  }

  const capIds   = topIds(conteosPorMes.map((c) => c.capitanes));
  const puntosIds = topIds(conteosPorMes.map((c) => c.puntos));
  const terrIds  = topIds(conteosPorMes.map((c) => c.territorios));

  const maxCap   = Math.max(1, ...capIds.flatMap((id) => conteosPorMes.map((c) => c.capitanes[id] || 0)));
  const maxPunto = Math.max(1, ...puntosIds.flatMap((id) => conteosPorMes.map((c) => c.puntos[id] || 0)));
  const mesesLabels = selectedMeses.map((m) => m.labelCorto);

  const sinDatos = capIds.length === 0 && puntosIds.length === 0 && terrIds.length === 0;

  return (
    <div className="border rounded-lg p-4 space-y-5 bg-muted/30">
      <h3 className="text-sm font-bold uppercase tracking-wide">{label}</h3>

      {sinDatos ? (
        <p className="text-sm text-muted-foreground">Sin datos para los meses seleccionados</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Capitanes */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Capitanes</p>
              {capIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              ) : (
                <div className="space-y-4">
                  {capIds.map((id) => (
                    <HorizontalBar
                      key={id}
                      label={participanteMap[id] || id}
                      values={conteosPorMes.map((c) => c.capitanes[id] || 0)}
                      max={maxCap}
                      meses={mesesLabels}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Puntos de encuentro */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Puntos de encuentro</p>
              {puntosIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              ) : (
                <div className="space-y-4">
                  {puntosIds.map((id) => (
                    <HorizontalBar
                      key={id}
                      label={puntoMap[id] || id}
                      values={conteosPorMes.map((c) => c.puntos[id] || 0)}
                      max={maxPunto}
                      meses={mesesLabels}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Territorios */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Territorios</p>
            {terrIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Territorio</th>
                      {selectedMeses.map((m, i) => (
                        <th key={m.inicio} className="text-center py-2 px-3 font-medium" style={{ color: MES_COLORS[i] }}>
                          {m.labelCorto}
                        </th>
                      ))}
                      {selectedMeses.length > 1 && (
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Tendencia</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {terrIds.map((id) => {
                      const vals = conteosPorMes.map((c) => c.territorios[id] || 0);
                      const diff = vals[0] - vals[vals.length - 1];
                      return (
                        <tr key={id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 pr-4 font-medium">{territorioMap[id] || id}</td>
                          {vals.map((v, i) => (
                            <td key={i} className="text-center py-2 px-3">
                              <Badge variant="secondary" className={v > 0 ? `${MES_BG[i]} ${MES_TEXT[i]}` : ""}>
                                {v}
                              </Badge>
                            </td>
                          ))}
                          {selectedMeses.length > 1 && (
                            <td className="text-center py-2 px-3">
                              <span className="flex items-center justify-center gap-1">
                                <TrendIcon diff={diff} />
                                {diff !== 0 && (
                                  <span className={`text-xs font-medium ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
                                    {Math.abs(diff)}
                                  </span>
                                )}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function calcConteos(rows: ReturnType<typeof useQuery<any[]>>["data"], filterFn: (fecha: string) => boolean, selectedMeses: { inicio: string; fin: string }[]) {
  return selectedMeses.map(({ inicio, fin }) => {
    const mesRows = (rows || []).filter((r) => r.fecha >= inicio && r.fecha <= fin && filterFn(r.fecha));
    const capitanes: CountMap = {};
    const puntosCount: CountMap = {};
    const terrCount: CountMap = {};

    for (const row of mesRows) {
      if (row.es_por_grupos) {
        const grupos = (Array.isArray(row.asignaciones_grupos) ? row.asignaciones_grupos : []) as AsignacionGrupo[];
        for (const g of grupos) {
          if (g.disabled) continue;
          if (g.capitan_id) capitanes[g.capitan_id] = (capitanes[g.capitan_id] || 0) + 1;
          if (g.punto_encuentro_id) puntosCount[g.punto_encuentro_id] = (puntosCount[g.punto_encuentro_id] || 0) + 1;
          const tids = g.territorio_ids?.length ? g.territorio_ids : g.territorio_id ? [g.territorio_id] : [];
          for (const tid of tids) terrCount[tid] = (terrCount[tid] || 0) + 1;
        }
      } else {
        if (row.capitan_id) capitanes[row.capitan_id] = (capitanes[row.capitan_id] || 0) + 1;
        if (row.punto_encuentro_id) puntosCount[row.punto_encuentro_id] = (puntosCount[row.punto_encuentro_id] || 0) + 1;
        const tids: string[] = Array.isArray(row.territorio_ids) && row.territorio_ids.length
          ? row.territorio_ids : row.territorio_id ? [row.territorio_id] : [];
        for (const tid of tids) terrCount[tid] = (terrCount[tid] || 0) + 1;
      }
    }
    return { capitanes, puntos: puntosCount, territorios: terrCount };
  });
}

export function EstadisticasPredicacion({
  participantes,
  puntos,
  territorios,
}: {
  participantes: { id: string; nombre: string; apellido: string }[];
  puntos: { id: string; nombre: string }[];
  territorios: { id: string; numero: string; nombre: string | null }[];
}) {
  const congregacionId = useCongregacionId();
  const hoy = new Date();

  const mesesOpciones = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(startOfMonth(hoy), i);
        return {
          label: format(d, "MMMM yyyy", { locale: es }),
          labelCorto: format(d, "MMM yy", { locale: es }),
          inicio: format(startOfMonth(d), "yyyy-MM-dd"),
          fin: format(endOfMonth(d), "yyyy-MM-dd"),
        };
      }),
    []
  );

  const [selectedIndices, setSelectedIndices] = useState<number[]>([0, 1]);

  function toggleMes(idx: number) {
    setSelectedIndices((prev) => {
      if (prev.includes(idx)) {
        if (prev.length === 1) return prev;
        return prev.filter((i) => i !== idx);
      }
      if (prev.length >= 3) return prev;
      return [...prev, idx].sort((a, b) => b - a);
    });
  }

  const selectedMeses = selectedIndices.map((i) => mesesOpciones[i]);
  const fechaMin = selectedMeses[selectedMeses.length - 1]?.inicio;
  const fechaMax = selectedMeses[0]?.fin;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["estadisticas-predicacion", congregacionId, fechaMin, fechaMax],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programa_predicacion")
        .select("fecha, capitan_id, punto_encuentro_id, territorio_id, territorio_ids, es_por_grupos, asignaciones_grupos, activo")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gte("fecha", fechaMin)
        .lte("fecha", fechaMax);
      if (error) throw error;
      return data || [];
    },
    enabled: !!congregacionId && !!fechaMin && !!fechaMax,
  });

  const participanteMap = useMemo(() => {
    const m: Record<string, string> = {};
    participantes.forEach((p) => { m[p.id] = `${p.nombre} ${p.apellido}`; });
    return m;
  }, [participantes]);

  const puntoMap = useMemo(() => {
    const m: Record<string, string> = {};
    puntos.forEach((p) => { m[p.id] = p.nombre; });
    return m;
  }, [puntos]);

  const territorioMap = useMemo(() => {
    const m: Record<string, string> = {};
    territorios.forEach((t) => { m[t.id] = `T${t.numero}${t.nombre ? ` ${t.nombre}` : ""}`; });
    return m;
  }, [territorios]);

  const conteosEntreSeamana = useMemo(
    () => calcConteos(rows, (f) => !isWeekend(f), selectedMeses),
    [rows, selectedMeses]
  );

  const conteosFinSemana = useMemo(
    () => calcConteos(rows, isWeekend, selectedMeses),
    [rows, selectedMeses]
  );

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Estadísticas de uso</h2>
      </div>

      {/* Selector de meses */}
      <div className="flex flex-wrap gap-2 items-center">
        {mesesOpciones.map((m, i) => {
          const selIdx = selectedIndices.indexOf(i);
          const isSelected = selIdx !== -1;
          return (
            <Button
              key={m.inicio}
              variant="outline"
              size="sm"
              onClick={() => toggleMes(i)}
              className={isSelected ? "border-2 font-semibold" : "opacity-60"}
              style={isSelected ? { borderColor: MES_COLORS[selIdx], color: MES_COLORS[selIdx] } : {}}
            >
              {m.label}
              {isSelected && (
                <span className="ml-1 inline-block w-2 h-2 rounded-full" style={{ backgroundColor: MES_COLORS[selIdx] }} />
              )}
            </Button>
          );
        })}
        <span className="text-xs text-muted-foreground">Máx. 3 meses</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="space-y-4">
          <StatsSet
            label="Entre semana"
            conteosPorMes={conteosEntreSeamana}
            selectedMeses={selectedMeses}
            participanteMap={participanteMap}
            puntoMap={puntoMap}
            territorioMap={territorioMap}
          />
          <StatsSet
            label="Fin de semana"
            conteosPorMes={conteosFinSemana}
            selectedMeses={selectedMeses}
            participanteMap={participanteMap}
            puntoMap={puntoMap}
            territorioMap={territorioMap}
          />
        </div>
      )}
    </div>
  );
}
