import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsignacionGrupo } from "@/types/programa-predicacion";

interface CountMap { [id: string]: number; }

const MES_COLORS = ["#185FA5", "#0F6E56", "#854F0B"];

function isWeekend(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Clave de ordenamiento: por territorio, o por semana/finde de un mes concreto. */
type SortKey =
  | { tipo: "territorio" }
  | { tipo: "semana" | "finde"; mes: number };

export function EstadisticasPredicacion({
  territorios,
}: {
  territorios: { id: string; numero: string; nombre: string | null }[];
}) {
  const congregacionId = useCongregacionId();
  const hoy = new Date();

  // Cantidad de meses disponibles = misma config que el Historial de predicación
  const { configuraciones: configPredicacion } = useConfiguracionSistema("predicacion");
  const cantidadHistorial =
    (configPredicacion?.find(
      (c) => c.programa_tipo === "predicacion" && c.clave === "cantidad_historial"
    )?.valor?.cantidad as number) || 6;

  const mesesOpciones = useMemo(
    () =>
      Array.from({ length: Math.max(1, cantidadHistorial) }, (_, i) => {
        const d = subMonths(startOfMonth(hoy), i);
        return {
          label: format(d, "MMM", { locale: es }).replace(".", "").slice(0, 3).toUpperCase(),
          labelLargo: format(d, "MMMM yyyy", { locale: es }),
          inicio: format(startOfMonth(d), "yyyy-MM-dd"),
          fin: format(endOfMonth(d), "yyyy-MM-dd"),
        };
      }),
    [cantidadHistorial]
  );

  const [selectedIndices, setSelectedIndices] = useState<number[]>([0, 1, 2]);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: { tipo: "territorio" },
    dir: "asc",
  });

  function toggleMes(idx: number) {
    setSelectedIndices((prev) => {
      if (prev.includes(idx)) {
        if (prev.length === 1) return prev;
        return prev.filter((i) => i !== idx);
      }
      if (prev.length >= 3) return prev;
      return [...prev, idx].sort((a, b) => b - a); // más reciente primero
    });
  }

  // Orden de columnas: de más antiguo a más reciente (índice mayor = mes más antiguo).
  const sortedIndices = useMemo(
    () => [...selectedIndices].sort((a, b) => b - a),
    [selectedIndices]
  );
  const selectedMeses = sortedIndices.map((i) => mesesOpciones[i]);
  // Rango real de la consulta: mínimo de los inicios y máximo de los fines (robusto al orden).
  const fechaMin = selectedMeses.length
    ? selectedMeses.map((m) => m.inicio).reduce((a, b) => (a < b ? a : b))
    : undefined;
  const fechaMax = selectedMeses.length
    ? selectedMeses.map((m) => m.fin).reduce((a, b) => (a > b ? a : b))
    : undefined;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["estadisticas-predicacion-terr", congregacionId, fechaMin, fechaMax],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programa_predicacion")
        .select("fecha, territorio_id, territorio_ids, es_por_grupos, asignaciones_grupos, activo")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gte("fecha", fechaMin)
        .lte("fecha", fechaMax);
      if (error) throw error;
      return data || [];
    },
    enabled: !!congregacionId && !!fechaMin && !!fechaMax,
  });

  // Conteos por mes: { semana: CountMap, finde: CountMap } por territorio
  const conteosPorMes = useMemo(() => {
    return selectedMeses.map(({ inicio, fin }) => {
      const semana: CountMap = {};
      const finde: CountMap = {};
      const mesRows = rows.filter((r) => r.fecha >= inicio && r.fecha <= fin);
      for (const row of mesRows) {
        const target = isWeekend(row.fecha) ? finde : semana;
        const acumular = (tids: string[]) => {
          for (const tid of tids) target[tid] = (target[tid] || 0) + 1;
        };
        if (row.es_por_grupos) {
          const grupos = (Array.isArray(row.asignaciones_grupos)
            ? row.asignaciones_grupos
            : []) as AsignacionGrupo[];
          for (const g of grupos) {
            if (g.disabled) continue;
            const tids = g.territorio_ids?.length
              ? g.territorio_ids
              : g.territorio_id
              ? [g.territorio_id]
              : [];
            acumular(tids);
          }
        } else {
          const tids: string[] =
            Array.isArray(row.territorio_ids) && row.territorio_ids.length
              ? row.territorio_ids
              : row.territorio_id
              ? [row.territorio_id]
              : [];
          acumular(tids);
        }
      }
      return { semana, finde };
    });
  }, [rows, selectedMeses]);

  // Filas base: todos los territorios activos con sus conteos por mes
  const filas = useMemo(() => {
    return territorios.map((t) => {
      const meses = conteosPorMes.map((c) => ({
        semana: c.semana[t.id] || 0,
        finde: c.finde[t.id] || 0,
      }));
      return { territorio: t, meses };
    });
  }, [territorios, conteosPorMes]);

  // Ordenamiento
  const filasOrdenadas = useMemo(() => {
    const arr = [...filas];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (key.tipo === "territorio") {
        const na = parseInt(a.territorio.numero, 10);
        const nb = parseInt(b.territorio.numero, 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return (na - nb) * mul;
        return a.territorio.numero.localeCompare(b.territorio.numero) * mul;
      }
      const va = a.meses[key.mes]?.[key.tipo] ?? 0;
      const vb = b.meses[key.mes]?.[key.tipo] ?? 0;
      if (va !== vb) return (va - vb) * mul;
      // Empate: ordenar por número de territorio asc como desempate estable
      const na = parseInt(a.territorio.numero, 10);
      const nb = parseInt(b.territorio.numero, 10);
      return (isNaN(na) || isNaN(nb) ? 0 : na - nb) || a.territorio.numero.localeCompare(b.territorio.numero);
    });
    return arr;
  }, [filas, sort]);

  function handleSort(key: SortKey) {
    setSort((prev) => {
      const same =
        prev.key.tipo === key.tipo &&
        (key.tipo === "territorio" || (prev.key as any).mes === (key as any).mes);
      if (same) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key.tipo === "territorio" ? "asc" : "desc" };
    });
  }

  function SortIcon({ activo, dir }: { activo: boolean; dir: "asc" | "desc" }) {
    if (!activo) return <ArrowUpDown className="h-3 w-3 inline opacity-40" />;
    return dir === "asc" ? (
      <ArrowUp className="h-3 w-3 inline" />
    ) : (
      <ArrowDown className="h-3 w-3 inline" />
    );
  }

  const isActiveSort = (key: SortKey) =>
    sort.key.tipo === key.tipo &&
    (key.tipo === "territorio" || (sort.key as any).mes === (key as any).mes);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Territorios utilizados</h2>
      </div>

      {/* Selector de meses (abreviatura de 3 letras) */}
      <div className="flex flex-wrap gap-2 items-center">
        {mesesOpciones.map((m, i) => {
          const selIdx = sortedIndices.indexOf(i);
          const isSelected = selIdx !== -1;
          return (
            <Button
              key={m.inicio}
              variant="outline"
              size="sm"
              onClick={() => toggleMes(i)}
              title={m.labelLargo}
              className={isSelected ? "border-2 font-semibold w-14" : "opacity-60 w-14"}
              style={isSelected ? { borderColor: MES_COLORS[selIdx], color: MES_COLORS[selIdx] } : {}}
            >
              {m.label}
            </Button>
          );
        })}
        <span className="text-xs text-muted-foreground">Máx. 3 meses</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay territorios activos</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th
                  rowSpan={2}
                  className="text-left py-2 px-3 font-semibold cursor-pointer select-none align-bottom border-r"
                  onClick={() => handleSort({ tipo: "territorio" })}
                >
                  Territorio{" "}
                  <SortIcon activo={isActiveSort({ tipo: "territorio" })} dir={sort.dir} />
                </th>
                {selectedMeses.map((m, i) => (
                  <th
                    key={m.inicio}
                    colSpan={2}
                    className={`text-center py-2 px-3 font-bold border-l ${i % 2 === 0 ? "bg-muted/40" : ""}`}
                    style={{ color: MES_COLORS[i] }}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b">
                {selectedMeses.map((m, i) => {
                  const zebra = i % 2 === 0 ? "bg-muted/40" : "";
                  return (
                    <Fragment key={m.inicio}>
                      <th
                        className={`text-center py-1.5 px-2 font-medium text-xs cursor-pointer select-none border-l text-muted-foreground hover:text-foreground ${zebra}`}
                        onClick={() => handleSort({ tipo: "semana", mes: i })}
                      >
                        SEMANA{" "}
                        <SortIcon activo={isActiveSort({ tipo: "semana", mes: i })} dir={sort.dir} />
                      </th>
                      <th
                        className={`text-center py-1.5 px-2 font-medium text-xs cursor-pointer select-none text-muted-foreground hover:text-foreground ${zebra}`}
                        onClick={() => handleSort({ tipo: "finde", mes: i })}
                      >
                        FINDE{" "}
                        <SortIcon activo={isActiveSort({ tipo: "finde", mes: i })} dir={sort.dir} />
                      </th>
                    </Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filasOrdenadas.map(({ territorio, meses }) => (
                <tr key={territorio.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 px-3 font-medium border-r whitespace-nowrap">
                    T{territorio.numero}
                    {territorio.nombre ? ` ${territorio.nombre}` : ""}
                  </td>
                  {meses.map((mv, i) => {
                    const zebra = i % 2 === 0 ? "bg-muted/40" : "";
                    const celda = (val: number, left: boolean) => (
                      <td className={`text-center py-1.5 px-2 ${left ? "border-l" : ""} ${zebra}`}>
                        {val === 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-500/10 text-red-500 text-xs font-semibold">
                            ✕
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-muted text-foreground text-xs font-semibold tabular-nums">
                            {val}
                          </span>
                        )}
                      </td>
                    );
                    return (
                      <Fragment key={i}>
                        {celda(mv.semana, true)}
                        {celda(mv.finde, false)}
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
