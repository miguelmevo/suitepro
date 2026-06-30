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

interface ParticipanteMap {
  [id: string]: string;
}

interface TerritoryMap {
  [id: string]: string;
}

interface PuntoMap {
  [id: string]: string;
}

interface CountMap {
  [id: string]: number;
}

const MES_COLORS = ["#185FA5", "#0F6E56", "#854F0B"];
const MES_BG = ["bg-blue-100", "bg-teal-100", "bg-amber-100"];
const MES_TEXT = ["text-blue-800", "text-teal-800", "text-amber-800"];
const MES_BAR = ["#185FA5", "#0F6E56", "#854F0B"];

function HorizontalBar({
  label,
  values,
  max,
  meses,
}: {
  label: string;
  values: number[];
  max: number;
  meses: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-foreground truncate" title={label}>
        {label}
      </div>
      {values.map((val, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 truncate shrink-0">{meses[i]}</span>
          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-1"
              style={{
                width: max > 0 ? `${(val / max) * 100}%` : "0%",
                backgroundColor: MES_BAR[i],
                minWidth: val > 0 ? "1.5rem" : "0",
              }}
            >
              {val > 0 && (
                <span className="text-white text-xs font-bold">{val}</span>
              )}
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

  // Últimos 6 meses como opciones
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
      return [...prev, idx].sort((a, b) => b - a); // descendente = más reciente primero
    });
  }

  const selectedMeses = selectedIndices.map((i) => mesesOpciones[i]);

  // Query que abarca el rango completo de los meses seleccionados
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

  // Lookup maps
  const participanteMap = useMemo<ParticipanteMap>(() => {
    const m: ParticipanteMap = {};
    participantes.forEach((p) => { m[p.id] = `${p.nombre} ${p.apellido}`; });
    return m;
  }, [participantes]);

  const puntoMap = useMemo<PuntoMap>(() => {
    const m: PuntoMap = {};
    puntos.forEach((p) => { m[p.id] = p.nombre; });
    return m;
  }, [puntos]);

  const territorioMap = useMemo<TerritoryMap>(() => {
    const m: TerritoryMap = {};
    territorios.forEach((t) => { m[t.id] = `T${t.numero}${t.nombre ? ` ${t.nombre}` : ""}`; });
    return m;
  }, [territorios]);

  // Conteos por mes
  const conteosPorMes = useMemo(() => {
    return selectedMeses.map(({ inicio, fin }) => {
      const mesRows = rows.filter((r) => r.fecha >= inicio && r.fecha <= fin);
      const capitanes: CountMap = {};
      const puntosCount: CountMap = {};
      const terrCount: CountMap = {};

      for (const row of mesRows) {
        if (row.es_por_grupos) {
          const grupos = (Array.isArray(row.asignaciones_grupos)
            ? row.asignaciones_grupos
            : []) as AsignacionGrupo[];
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
            ? row.territorio_ids
            : row.territorio_id ? [row.territorio_id] : [];
          for (const tid of tids) terrCount[tid] = (terrCount[tid] || 0) + 1;
        }
      }
      return { capitanes, puntos: puntosCount, territorios: terrCount };
    });
  }, [rows, selectedMeses]);

  // Ordenar IDs por total desc
  function topIds(maps: CountMap[], limit = 15) {
    const allIds = new Set(maps.flatMap((m) => Object.keys(m)));
    return [...allIds]
      .map((id) => ({ id, total: maps.reduce((s, m) => s + (m[id] || 0), 0) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map((x) => x.id);
  }

  const capIds = useMemo(() => topIds(conteosPorMes.map((c) => c.capitanes)), [conteosPorMes]);
  const puntosIds = useMemo(() => topIds(conteosPorMes.map((c) => c.puntos)), [conteosPorMes]);
  const terrIds = useMemo(() => topIds(conteosPorMes.map((c) => c.territorios)), [conteosPorMes]);

  const maxCap = useMemo(() => Math.max(1, ...capIds.flatMap((id) => conteosPorMes.map((c) => c.capitanes[id] || 0))), [capIds, conteosPorMes]);
  const maxPunto = useMemo(() => Math.max(1, ...puntosIds.flatMap((id) => conteosPorMes.map((c) => c.puntos[id] || 0))), [puntosIds, conteosPorMes]);

  const mesesLabels = selectedMeses.map((m) => m.labelCorto);

  if (isLoading) return null;

  return (
    <div className="border rounded-lg p-4 space-y-6 bg-card">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Estadísticas de uso</h2>
      </div>

      {/* Selector de meses */}
      <div className="flex flex-wrap gap-2">
        {mesesOpciones.map((m, i) => {
          const selIdx = selectedIndices.indexOf(i);
          const isSelected = selIdx !== -1;
          return (
            <Button
              key={m.inicio}
              variant="outline"
              size="sm"
              onClick={() => toggleMes(i)}
              className={
                isSelected
                  ? `border-2 font-semibold`
                  : "opacity-60"
              }
              style={isSelected ? { borderColor: MES_COLORS[selIdx], color: MES_COLORS[selIdx] } : {}}
            >
              {m.label}
              {isSelected && (
                <span
                  className="ml-1 inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: MES_COLORS[selIdx] }}
                />
              )}
            </Button>
          );
        })}
        <span className="text-xs text-muted-foreground self-center">Máx. 3 meses</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Capitanes — barras horizontales */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Capitanes</h3>
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

        {/* Puntos de encuentro — barras horizontales */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Puntos de encuentro</h3>
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

      {/* Territorios — tabla */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Territorios</h3>
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
                          <Badge
                            variant="secondary"
                            className={v > 0 ? `${MES_BG[i]} ${MES_TEXT[i]}` : ""}
                          >
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
    </div>
  );
}
