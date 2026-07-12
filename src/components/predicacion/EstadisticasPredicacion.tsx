import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, ArrowUp, ArrowDown, ArrowUpDown, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AsignacionGrupo } from "@/types/programa-predicacion";

interface CountMap { [id: string]: number; }
interface DatesMap { [id: string]: string[]; }

const MES_COLORS = ["#185FA5", "#0F6E56", "#854F0B"];

function isWeekend(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Convierte una lista de fechas (yyyy-MM-dd, con posibles repetidas) en un texto para tooltip:
 *  una línea por día ("martes 5"), en orden cronológico; días repetidos muestran "(×N)". */
function fechasTooltip(fechas: string[]): string {
  if (!fechas.length) return "";
  const counts = new Map<string, number>();
  for (const f of [...fechas].sort()) counts.set(f, (counts.get(f) || 0) + 1);
  return [...counts.entries()]
    .map(([f, n]) => {
      const label = format(parseISO(f), "EEEE d", { locale: es });
      return n > 1 ? `${label} (×${n})` : label;
    })
    .join("\n");
}

/** Semanas del mes (lunes→domingo) como matriz de celdas; null = relleno. */
function semanasDelMes(mesInicioISO: string): (Date | null)[][] {
  const start = startOfMonth(parseISO(mesInicioISO));
  const end = endOfMonth(start);
  const dias = eachDayOfInterval({ start, end });
  const primerDow = (start.getDay() + 6) % 7; // 0 = lunes
  const celdas: (Date | null)[] = [...Array(primerDow).fill(null), ...dias];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas: (Date | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

/** Mini-calendario de un mes con los días trabajados resaltados (azul=semana, teal=finde). */
function CalendarioMes({
  mesInicio,
  dias,
}: {
  mesInicio: string;
  dias: Map<string, { count: number; esFinde: boolean }>;
}) {
  const semanas = semanasDelMes(mesInicio);
  const dow = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <table className="border-collapse">
      <thead>
        <tr>
          {dow.map((d, i) => (
            <th key={i} className="w-9 h-6 text-center text-[10px] text-muted-foreground font-medium">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {semanas.map((sem, wi) => (
          <tr key={wi}>
            {sem.map((day, di) => {
              if (!day) return <td key={di} className="w-9 h-9" />;
              const iso = format(day, "yyyy-MM-dd");
              const info = dias.get(iso);
              const dn = day.getDate();
              if (!info)
                return (
                  <td key={di} className="w-9 h-9 text-center text-xs text-muted-foreground/30">
                    {dn}
                  </td>
                );
              return (
                <td key={di} className="w-9 h-9 p-0.5">
                  <div
                    title={info.count > 1 ? `${info.count} salidas` : "1 salida"}
                    className={`relative w-full h-full rounded-md flex items-center justify-center text-xs font-bold ${
                      info.esFinde
                        ? "bg-teal-500/20 text-teal-700 dark:text-teal-300"
                        : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {dn}
                    {info.count > 1 && (
                      <span className="absolute -top-1 -right-1 text-[8px] leading-none bg-foreground text-background rounded-full px-1 py-0.5">
                        ×{info.count}
                      </span>
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Clave de ordenamiento: por territorio, o por semana/finde de un mes concreto. */
type SortKey =
  | { tipo: "territorio" }
  | { tipo: "semana" | "finde" | "total"; mes: number };

export function EstadisticasPredicacion({
  territorios,
}: {
  territorios: { id: string; numero: string; nombre: string | null; incluir_en_estadisticas?: boolean }[];
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

  // Conteos por mes: un territorio cuenta **una vez por SALIDA** (salida_index).
  // Los grupos que rotan dentro de una misma salida se fusionan (no multiplican).
  // Si un territorio aparece en salidas distintas (incluso el mismo día), cuenta cada una
  // → así se detecta si por error quedó asignado en varias salidas.
  const conteosPorMes = useMemo(() => {
    return selectedMeses.map(({ inicio, fin }) => {
      const semana: CountMap = {};
      const finde: CountMap = {};
      const semanaDates: DatesMap = {};
      const findeDates: DatesMap = {};
      const mesRows = rows.filter((r) => r.fecha >= inicio && r.fecha <= fin);

      for (const row of mesRows) {
        const esFinde = isWeekend(row.fecha);
        const target = esFinde ? finde : semana;
        const targetDates = esFinde ? findeDates : semanaDates;

        // Territorios distintos por salida (clave = salida_index; fallback a grupo/índice)
        const salidas = new Map<string, Set<string>>();
        if (row.es_por_grupos) {
          const grupos = (Array.isArray(row.asignaciones_grupos)
            ? row.asignaciones_grupos
            : []) as AsignacionGrupo[];
          grupos.forEach((g, idx) => {
            if (g.disabled) return;
            const key =
              g.salida_index !== undefined && g.salida_index !== null
                ? `s${g.salida_index}`
                : g.grupo_id ?? g.grupo_ficticio_id ?? `g${idx}`;
            const set = salidas.get(key) ?? new Set<string>();
            salidas.set(key, set);
            const tids = g.territorio_ids?.length
              ? g.territorio_ids
              : g.territorio_id
              ? [g.territorio_id]
              : [];
            for (const t of tids) if (t) set.add(t);
          });
        } else {
          const tids: string[] =
            Array.isArray(row.territorio_ids) && row.territorio_ids.length
              ? row.territorio_ids
              : row.territorio_id
              ? [row.territorio_id]
              : [];
          salidas.set("row", new Set(tids.filter(Boolean)));
        }

        // Contar 1 por (territorio, salida) y registrar la fecha
        for (const set of salidas.values()) {
          for (const tid of set) {
            target[tid] = (target[tid] || 0) + 1;
            (targetDates[tid] = targetDates[tid] || []).push(row.fecha);
          }
        }
      }
      return { semana, finde, semanaDates, findeDates };
    });
  }, [rows, selectedMeses]);

  // Filas base: territorios activos incluidos en estadísticas, con sus conteos por mes
  const filas = useMemo(() => {
    return territorios
      .filter((t) => t.incluir_en_estadisticas !== false)
      .map((t) => {
      const meses = conteosPorMes.map((c) => ({
        semana: c.semana[t.id] || 0,
        finde: c.finde[t.id] || 0,
        semanaDates: c.semanaDates[t.id] || [],
        findeDates: c.findeDates[t.id] || [],
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
      const valDe = (fila: typeof a, k: Extract<SortKey, { mes: number }>) => {
        const m = fila.meses[k.mes];
        if (!m) return 0;
        return k.tipo === "total" ? m.semana + m.finde : m[k.tipo];
      };
      const va = valDe(a, key);
      const vb = valDe(b, key);
      if (va !== vb) return (va - vb) * mul;
      // Empate: ordenar por número de territorio asc como desempate estable
      const na = parseInt(a.territorio.numero, 10);
      const nb = parseInt(b.territorio.numero, 10);
      return (isNaN(na) || isNaN(nb) ? 0 : na - nb) || a.territorio.numero.localeCompare(b.territorio.numero);
    });
    return arr;
  }, [filas, sort]);

  // --- Filtro por territorio + vista de detalle ---
  const [territorioFiltro, setTerritorioFiltro] = useState<string>("todos");
  const territoriosOrdenados = useMemo(
    () =>
      territorios
        .filter((t) => t.incluir_en_estadisticas !== false)
        .sort(
          (a, b) =>
            (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0) ||
            a.numero.localeCompare(b.numero)
        ),
    [territorios]
  );
  const territorioSel =
    territorioFiltro === "todos" ? null : territorios.find((t) => t.id === territorioFiltro) ?? null;

  const detallePorMes = useMemo(() => {
    if (!territorioSel) return [];
    return selectedMeses.map((m, i) => {
      const c = conteosPorMes[i];
      const semD = c.semanaDates[territorioSel.id] || [];
      const finD = c.findeDates[territorioSel.id] || [];
      const dias = new Map<string, { count: number; esFinde: boolean }>();
      for (const f of semD) {
        const cur = dias.get(f);
        dias.set(f, { count: (cur?.count || 0) + 1, esFinde: false });
      }
      for (const f of finD) {
        const cur = dias.get(f);
        dias.set(f, { count: (cur?.count || 0) + 1, esFinde: cur?.esFinde ?? true });
      }
      return {
        mes: m,
        dias,
        salidas: semD.length + finD.length,
        diasSemana: new Set(semD).size,
        diasFinde: new Set(finD).size,
      };
    });
  }, [territorioSel, selectedMeses, conteosPorMes]);

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

      {/* Filtro por territorio */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Ver:</span>
        <Select value={territorioFiltro} onValueChange={setTerritorioFiltro}>
          <SelectTrigger className="h-8 w-[260px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los territorios (tabla)</SelectItem>
            {territoriosOrdenados.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                T{t.numero}
                {t.nombre ? ` ${t.nombre}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {territorioSel ? (
        /* ---- Detalle de un territorio (calendarios) ---- */
        isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-5">
            <div className="text-base font-bold">
              T{territorioSel.numero}
              {territorioSel.nombre ? ` — ${territorioSel.nombre}` : ""}
            </div>
            <div className="flex flex-wrap gap-4">
              {detallePorMes.map((d, i) => (
                <div key={d.mes.inicio} className="border rounded-lg p-3 bg-card">
                  <div className="font-semibold capitalize mb-2" style={{ color: MES_COLORS[i] }}>
                    {d.mes.labelLargo}
                  </div>
                  <div className="flex gap-2 mb-3 text-xs">
                    <span className="px-2 py-1 rounded-md bg-muted font-semibold">
                      {d.diasSemana + d.diasFinde} días
                    </span>
                    <span className="px-2 py-1 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold">
                      {d.diasSemana} entre sem.
                    </span>
                    <span className="px-2 py-1 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300 font-semibold">
                      {d.diasFinde} finde
                    </span>
                  </div>
                  {d.dias.size === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">Sin actividad este mes</p>
                  ) : (
                    <CalendarioMes mesInicio={d.mes.inicio} dias={d.dias} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-500/40 inline-block" /> Entre semana
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-teal-500/40 inline-block" /> Fin de semana
              </span>
              <span>×N = varias salidas ese día</span>
            </div>
          </div>
        )
      ) : isLoading ? (
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
                    colSpan={3}
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
                      <th
                        className={`text-center py-1.5 px-2 font-semibold text-xs cursor-pointer select-none hover:text-foreground ${zebra}`}
                        onClick={() => handleSort({ tipo: "total", mes: i })}
                      >
                        TOTAL{" "}
                        <SortIcon activo={isActiveSort({ tipo: "total", mes: i })} dir={sort.dir} />
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
                    const celda = (val: number, fechas: string[], left: boolean) => {
                      const tip = fechasTooltip(fechas);
                      return (
                        <td
                          className={`text-center py-1.5 px-2 ${left ? "border-l" : ""} ${zebra}`}
                          title={tip || undefined}
                        >
                          {val === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-500/10 text-red-500 text-xs font-semibold">
                              ✕
                            </span>
                          ) : (
                            <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-muted text-foreground text-xs font-semibold tabular-nums ${tip ? "cursor-help" : ""}`}>
                              {val}
                            </span>
                          )}
                        </td>
                      );
                    };
                    const total = mv.semana + mv.finde;
                    const totalTip = fechasTooltip([...mv.semanaDates, ...mv.findeDates]);
                    return (
                      <Fragment key={i}>
                        {celda(mv.semana, mv.semanaDates, true)}
                        {celda(mv.finde, mv.findeDates, false)}
                        <td className={`text-center py-1.5 px-2 ${zebra}`} title={totalTip || undefined}>
                          {total === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-500/10 text-red-500 text-xs font-semibold">
                              ✕
                            </span>
                          ) : (
                            <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-primary/10 text-primary text-xs font-bold tabular-nums ${totalTip ? "cursor-help" : ""}`}>
                              {total}
                            </span>
                          )}
                        </td>
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
