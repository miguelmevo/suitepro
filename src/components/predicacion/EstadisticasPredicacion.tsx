import { useState, useMemo, useEffect, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, differenceInCalendarMonths, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUp, ArrowDown, ArrowUpDown, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AsignacionGrupo } from "@/types/programa-predicacion";

interface CountMap { [id: string]: number; }
interface DatesMap { [id: string]: string[]; }

/** Entidad de la que se calculan estadísticas (territorio o punto de encuentro). */
export interface EntidadStat {
  id: string;
  label: string;
  /** Para ordenar: los numéricos primero por valor, los null (texto) al final alfabéticamente. */
  sortNum: number | null;
  incluir?: boolean;
}

const MES_COLORS = ["#185FA5", "#0F6E56", "#854F0B"];

function isWeekend(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function cmpEntidad(a: EntidadStat, b: EntidadStat): number {
  const aNum = a.sortNum != null;
  const bNum = b.sortNum != null;
  if (aNum && bNum) return (a.sortNum as number) - (b.sortNum as number);
  if (aNum) return -1;
  if (bNum) return 1;
  return a.label.localeCompare(b.label);
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

/** Clave de ordenamiento: por entidad, o por semana/finde/total de un mes concreto. */
type SortKey =
  | { tipo: "entidad" }
  | { tipo: "semana" | "finde" | "total"; mes: number };

export function EstadisticasUso({
  dimension,
  territorios,
  puntos,
  capitanes,
}: {
  dimension: "territorio" | "punto" | "capitan";
  territorios: { id: string; numero: string; nombre: string | null; incluir_en_estadisticas?: boolean }[];
  puntos: { id: string; nombre: string }[];
  /** Participantes que son capitanes (activos): se listan todos, hayan salido o no. */
  capitanes: { id: string; nombre: string; apellido: string }[];
}) {
  const congregacionId = useCongregacionId();
  const hoy = new Date();

  const columnaLabel =
    dimension === "punto" ? "Punto de encuentro" : dimension === "capitan" ? "Capitán" : "Territorio";
  const entidades: EntidadStat[] = useMemo(() => {
    if (dimension === "capitan") {
      return capitanes.map((c) => ({
        id: c.id,
        label: `${c.apellido}, ${c.nombre}`,
        sortNum: null as number | null,
        incluir: true,
      }));
    }
    if (dimension === "punto") {
      return puntos.map((p) => ({ id: p.id, label: p.nombre, sortNum: null as number | null, incluir: true }));
    }
    return territorios.map((t) => {
      const n = parseInt(t.numero, 10);
      return {
        id: t.id,
        label: `T${t.numero}${t.nombre ? ` ${t.nombre}` : ""}`,
        sortNum: Number.isNaN(n) ? null : n,
        incluir: t.incluir_en_estadisticas,
      };
    });
  }, [dimension, territorios, puntos, capitanes]);

  // Cantidad de meses disponibles = misma config que el Historial de predicación
  const { configuraciones: configPredicacion } = useConfiguracionSistema("predicacion");
  const cantidadHistorial =
    (configPredicacion?.find(
      (c) => c.programa_tipo === "predicacion" && c.clave === "cantidad_historial"
    )?.valor?.cantidad as number) || 6;

  // Meses futuros que ya tienen programa (al menos 1 salida creada): se traen para
  // desplazar la ventana hacia adelante sin cambiar la cantidad total de meses.
  const { data: futuroRows = [] } = useQuery({
    queryKey: ["estadisticas-meses-futuros-predicacion", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programa_predicacion")
        .select("fecha")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gt("fecha", format(endOfMonth(hoy), "yyyy-MM-dd"))
        .order("fecha", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!congregacionId,
  });
  const mesesFuturos = futuroRows.length
    ? Math.max(0, differenceInCalendarMonths(parseISO(futuroRows[0].fecha), startOfMonth(hoy)))
    : 0;

  const mesesOpciones = useMemo(
    () =>
      Array.from({ length: Math.max(1, cantidadHistorial) }, (_, i) => {
        // i=0 = mes más reciente disponible (puede ser un mes futuro con programa).
        const d = addMonths(startOfMonth(hoy), mesesFuturos - i);
        const mmm = format(d, "MMM", { locale: es }).replace(".", "").slice(0, 3).toUpperCase();
        return {
          label: `${mmm} ${format(d, "yy")}`,
          labelLargo: format(d, "MMMM yyyy", { locale: es }),
          inicio: format(startOfMonth(d), "yyyy-MM-dd"),
          fin: format(endOfMonth(d), "yyyy-MM-dd"),
        };
      }),
    [cantidadHistorial, mesesFuturos]
  );

  const [selectedIndices, setSelectedIndices] = useState<number[]>([0, 1, 2]);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: { tipo: "entidad" },
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
  const fechaMin = selectedMeses.length
    ? selectedMeses.map((m) => m.inicio).reduce((a, b) => (a < b ? a : b))
    : undefined;
  const fechaMax = selectedMeses.length
    ? selectedMeses.map((m) => m.fin).reduce((a, b) => (a > b ? a : b))
    : undefined;

  // Se traen todos los campos necesarios (territorio + punto) y se comparte la caché entre pestañas.
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["estadisticas-uso-predicacion", "v2", congregacionId, fechaMin, fechaMax],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programa_predicacion")
        .select(
          "fecha, territorio_id, territorio_ids, punto_encuentro_id, capitan_id, es_por_grupos, asignaciones_grupos, activo"
        )
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gte("fecha", fechaMin)
        .lte("fecha", fechaMax);
      if (error) throw error;
      return data || [];
    },
    enabled: !!congregacionId && !!fechaMin && !!fechaMax,
  });

  // Indisponibilidad (viajes, licencias…) de los capitanes que se cruza con los meses
  // elegidos: se avisa en la fila, con el mismo formato que el resto de la app.
  const { data: indisp = [] } = useQuery({
    queryKey: ["estadisticas-indisponibilidad-capitanes", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indisponibilidad_participantes")
        .select("participante_id,fecha_inicio,fecha_fin,tipo_responsabilidad,motivo")
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true);
      if (error) throw error;
      return (data || []) as {
        participante_id: string;
        fecha_inicio: string;
        fecha_fin: string | null;
        tipo_responsabilidad: string[];
        motivo: string | null;
      }[];
    },
    enabled: !!congregacionId && dimension === "capitan",
  });
  const indispPorCapitan = useMemo(() => {
    const m = new Map<string, string[]>();
    if (dimension !== "capitan" || !fechaMin || !fechaMax) return m;
    const corta = (f: string) => format(parseISO(f), "d MMM", { locale: es });
    const ordenadas = [...indisp].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
    for (const i of ordenadas) {
      const fin = i.fecha_fin ?? i.fecha_inicio;
      if (i.fecha_inicio > fechaMax || fin < fechaMin) continue;
      if (!(i.tipo_responsabilidad.includes("todas") || i.tipo_responsabilidad.includes("predicacion"))) continue;
      const rango = fin !== i.fecha_inicio ? `${corta(i.fecha_inicio)} – ${corta(fin)}` : corta(i.fecha_inicio);
      const lista = m.get(i.participante_id) ?? [];
      lista.push(`${i.motivo?.trim() || "No disponible"} ${rango}`);
      m.set(i.participante_id, lista);
    }
    return m;
  }, [dimension, indisp, fechaMin, fechaMax]);

  // Extrae los IDs de la dimensión (territorio o punto) desde un grupo o desde la fila.
  const extraerIds = useMemo(() => {
    return (src: {
      territorio_id?: string | null;
      territorio_ids?: string[] | null;
      punto_encuentro_id?: string | null;
      capitan_id?: string | null;
    }): string[] => {
      if (dimension === "capitan") {
        return src.capitan_id ? [src.capitan_id] : [];
      }
      if (dimension === "punto") {
        return src.punto_encuentro_id ? [src.punto_encuentro_id] : [];
      }
      return src.territorio_ids?.length
        ? src.territorio_ids
        : src.territorio_id
        ? [src.territorio_id]
        : [];
    };
  }, [dimension]);

  // Conteos por mes: cuenta **una vez por SALIDA** (salida_index). Los grupos que rotan
  // dentro de una misma salida se fusionan (no multiplican). Salidas distintas cuentan cada una.
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
            for (const t of extraerIds(g)) if (t) set.add(t);
          });
        } else {
          salidas.set("row", new Set(extraerIds(row).filter(Boolean)));
        }

        for (const set of salidas.values()) {
          for (const id of set) {
            target[id] = (target[id] || 0) + 1;
            (targetDates[id] = targetDates[id] || []).push(row.fecha);
          }
        }
      }
      return { semana, finde, semanaDates, findeDates };
    });
  }, [rows, selectedMeses, extraerIds]);

  const entidadesIncluidas = useMemo(
    () => entidades.filter((e) => e.incluir !== false),
    [entidades]
  );
  const entidadesOrdenadas = useMemo(
    () => [...entidadesIncluidas].sort(cmpEntidad),
    [entidadesIncluidas]
  );

  // Filas base: entidades incluidas con sus conteos por mes
  const filas = useMemo(() => {
    return entidadesIncluidas.map((e) => {
      const meses = conteosPorMes.map((c) => ({
        semana: c.semana[e.id] || 0,
        finde: c.finde[e.id] || 0,
        semanaDates: c.semanaDates[e.id] || [],
        findeDates: c.findeDates[e.id] || [],
      }));
      return { entidad: e, meses };
    });
  }, [entidadesIncluidas, conteosPorMes]);

  // Ordenamiento
  const filasOrdenadas = useMemo(() => {
    const arr = [...filas];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (key.tipo === "entidad") return cmpEntidad(a.entidad, b.entidad) * mul;
      const valDe = (fila: typeof a, k: Extract<SortKey, { mes: number }>) => {
        const m = fila.meses[k.mes];
        if (!m) return 0;
        return k.tipo === "total" ? m.semana + m.finde : m[k.tipo];
      };
      const va = valDe(a, key);
      const vb = valDe(b, key);
      if (va !== vb) return (va - vb) * mul;
      return cmpEntidad(a.entidad, b.entidad); // desempate estable
    });
    return arr;
  }, [filas, sort]);

  // --- Filtro por entidad + vista de detalle ---
  const [filtro, setFiltro] = useState<string>("todos");
  useEffect(() => setFiltro("todos"), [dimension]);
  const entidadSel = filtro === "todos" ? null : entidades.find((e) => e.id === filtro) ?? null;

  const detalleDe = (id: string) =>
    selectedMeses.map((m, i) => {
      const c = conteosPorMes[i];
      const semD = c.semanaDates[id] || [];
      const finD = c.findeDates[id] || [];
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
        diasSemana: new Set(semD).size,
        diasFinde: new Set(finD).size,
      };
    });
  const detallePorMes = useMemo(
    () => (entidadSel ? detalleDe(entidadSel.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entidadSel, selectedMeses, conteosPorMes]
  );

  // Ventana con el detalle al tocar un capitán de la tabla.
  const [detalleAbiertoId, setDetalleAbiertoId] = useState<string | null>(null);
  const entidadAbierta = detalleAbiertoId ? entidades.find((e) => e.id === detalleAbiertoId) ?? null : null;

  const renderCalendarios = (detalle: ReturnType<typeof detalleDe>) => (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        {detalle.map((d, i) => (
          <div key={d.mes.inicio} className="border rounded-lg p-3 bg-card">
            <div className="font-semibold capitalize mb-2" style={{ color: MES_COLORS[i] }}>
              {d.mes.labelLargo}
            </div>
            <div className="flex gap-2 mb-3 text-xs">
              <span className="px-2 py-1 rounded-md bg-muted font-semibold">{d.diasSemana + d.diasFinde} días</span>
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
  );

  // Resumen por mes (sólo capitanes): cuántos salieron y cuántos quedaron sin usar.
  const resumenCapitanes = useMemo(() => {
    if (dimension !== "capitan") return [];
    return selectedMeses.map((m, i) => {
      const c = conteosPorMes[i];
      const usados = entidadesIncluidas.filter((e) => (c.semana[e.id] || 0) + (c.finde[e.id] || 0) > 0).length;
      const idsSinUsar = entidadesIncluidas
        .filter((e) => (c.semana[e.id] || 0) + (c.finde[e.id] || 0) === 0)
        .map((e) => e.id);
      return { mes: m, usados, sinUsar: idsSinUsar.length, idsSinUsar, total: entidadesIncluidas.length };
    });
  }, [dimension, selectedMeses, conteosPorMes, entidadesIncluidas]);

  // Ventana con los capitanes sin utilizar de un mes y su última vez como capitán.
  const [sinUsarMesIdx, setSinUsarMesIdx] = useState<number | null>(null);
  const sinUsarDetalle = sinUsarMesIdx != null ? resumenCapitanes[sinUsarMesIdx] ?? null : null;
  const { data: ultimaVez, isLoading: cargandoUltima } = useQuery({
    queryKey: ["capitanes-ultima-vez", congregacionId, sinUsarDetalle?.mes.inicio, sinUsarDetalle?.idsSinUsar.join(",")],
    queryFn: async () => {
      // Recorre el historial hacia atrás (de a 1000 filas) hasta ubicar a todos o agotarlo.
      const pendientes = new Set(sinUsarDetalle!.idsSinUsar);
      const res: Record<string, string> = {};
      for (let desde = 0; pendientes.size > 0; desde += 1000) {
        const { data, error } = await supabase
          .from("programa_predicacion")
          .select("fecha, capitan_id, es_por_grupos, asignaciones_grupos")
          .eq("congregacion_id", congregacionId)
          .eq("activo", true)
          .lt("fecha", sinUsarDetalle!.mes.inicio)
          .order("fecha", { ascending: false })
          .range(desde, desde + 999);
        if (error) throw error;
        for (const row of data || []) {
          const ids: string[] = [];
          if (row.capitan_id) ids.push(row.capitan_id);
          if (row.es_por_grupos && Array.isArray(row.asignaciones_grupos)) {
            for (const g of row.asignaciones_grupos as unknown as AsignacionGrupo[]) {
              if (!g.disabled && g.capitan_id) ids.push(g.capitan_id);
            }
          }
          for (const id of ids) {
            if (pendientes.has(id)) {
              res[id] = row.fecha;
              pendientes.delete(id);
            }
          }
        }
        if (!data || data.length < 1000) break;
      }
      return res;
    },
    enabled: !!congregacionId && !!sinUsarDetalle && sinUsarDetalle.idsSinUsar.length > 0,
  });
  const filasSinUsar = useMemo(() => {
    if (!sinUsarDetalle) return [];
    return sinUsarDetalle.idsSinUsar
      .map((id) => ({ entidad: entidades.find((e) => e.id === id)!, ultima: ultimaVez?.[id] ?? null }))
      .filter((f) => f.entidad)
      // Primero quienes llevan más tiempo sin ser capitán (o nunca lo fueron).
      .sort((a, b) => {
        if (a.ultima === b.ultima) return a.entidad.label.localeCompare(b.entidad.label);
        if (!a.ultima) return -1;
        if (!b.ultima) return 1;
        return a.ultima.localeCompare(b.ultima);
      });
  }, [sinUsarDetalle, ultimaVez, entidades]);

  function handleSort(key: SortKey) {
    setSort((prev) => {
      const same =
        prev.key.tipo === key.tipo &&
        (key.tipo === "entidad" || (prev.key as any).mes === (key as any).mes);
      if (same) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key.tipo === "entidad" ? "asc" : "desc" };
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
    (key.tipo === "entidad" || (sort.key as any).mes === (key as any).mes);

  return (
    <div className="space-y-4 pt-2">

      {/* Fila 2: selector "Ver" + selector de meses */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Ver:</span>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="h-8 w-[240px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos (tabla)</SelectItem>
              {entidadesOrdenadas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                className={isSelected ? "border-2 font-semibold w-16" : "opacity-60 w-16"}
                style={isSelected ? { borderColor: MES_COLORS[selIdx], color: MES_COLORS[selIdx] } : {}}
              >
                {m.label}
              </Button>
            );
          })}
          <span className="text-xs text-muted-foreground">Máx. 3 meses</span>
        </div>
      </div>

      {dimension === "capitan" && !entidadSel && !isLoading && resumenCapitanes.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {resumenCapitanes.map((r, i) => (
            <div
              key={r.mes.inicio}
              className="space-y-2 rounded-2xl border-2 p-3"
              style={{ borderColor: MES_COLORS[i], backgroundColor: `${MES_COLORS[i]}14` }}
            >
              <div className="text-sm font-bold capitalize" style={{ color: MES_COLORS[i] }}>
                {r.mes.labelLargo}
              </div>
              <div className="flex gap-2">
                <div className="border rounded-lg px-3 py-2 bg-card min-w-[110px]">
                  <div className="text-xl font-bold tabular-nums leading-none">
                    {r.usados}
                    <span className="text-xs font-normal text-muted-foreground"> de {r.total}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Utilizados</div>
                </div>
                <button
                  type="button"
                  disabled={r.sinUsar === 0}
                  onClick={() => setSinUsarMesIdx(i)}
                  title={r.sinUsar ? "Ver quiénes no fueron utilizados" : undefined}
                  className={`border rounded-lg px-3 py-2 bg-card min-w-[110px] text-left transition-colors outline-none ${
                    r.sinUsar ? "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50" : "cursor-default"
                  }`}
                >
                  <div
                    className={`text-xl font-bold tabular-nums leading-none ${r.sinUsar ? "text-red-500" : ""}`}
                  >
                    {r.sinUsar}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Sin utilizar{r.sinUsar ? " ›" : ""}
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {entidadSel ? (
        /* ---- Detalle de una entidad (calendarios) ---- */
        isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-5">
            <div className="text-base font-bold">
              {entidadSel.label}
              {(indispPorCapitan.get(entidadSel.id) ?? []).map((txt) => (
                <span key={txt} className="ml-2 inline-flex items-center gap-1 align-middle">
                  <span className="inline-block text-[9px] font-bold px-1 rounded bg-red-500/25 text-red-600 dark:text-red-300">
                    NO DISP
                  </span>
                  <span className="text-xs font-normal text-foreground/80">{txt}</span>
                </span>
              ))}
            </div>
            {renderCalendarios(detallePorMes)}
          </div>
        )
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay datos</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th
                  rowSpan={2}
                  className="text-left py-2 px-3 font-semibold cursor-pointer select-none align-bottom border-r"
                  onClick={() => handleSort({ tipo: "entidad" })}
                >
                  {columnaLabel}{" "}
                  <SortIcon activo={isActiveSort({ tipo: "entidad" })} dir={sort.dir} />
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
              {filasOrdenadas.map(({ entidad, meses }) => (
                <tr
                  key={entidad.id}
                  className={
                    dimension === "capitan"
                      ? "border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 outline-none"
                      : "border-b last:border-0 hover:bg-muted/50"
                  }
                  {...(dimension === "capitan"
                    ? {
                        tabIndex: 0,
                        title: "Ver calendario del capitán",
                        onClick: () => setDetalleAbiertoId(entidad.id),
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetalleAbiertoId(entidad.id);
                          }
                        },
                      }
                    : {})}
                >
                  <td className="py-2 px-3 font-medium border-r whitespace-nowrap">
                    {entidad.label}
                    {(indispPorCapitan.get(entidad.id) ?? []).map((txt) => (
                      <span key={txt} className="ml-2 inline-flex items-center gap-1 align-middle">
                        <span className="inline-block text-[9px] font-bold px-1 rounded bg-red-500/25 text-red-600 dark:text-red-300">
                          NO DISP
                        </span>
                        <span className="text-[11px] font-normal text-foreground/80">{txt}</span>
                      </span>
                    ))}
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

      <Dialog open={!!sinUsarDetalle} onOpenChange={(o) => !o && setSinUsarMesIdx(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Sin utilizar en <span className="capitalize">{sinUsarDetalle?.mes.labelLargo}</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            {sinUsarDetalle?.sinUsar} capitanes. Se muestra la última vez que fueron capitán antes de ese mes.
          </p>
          {cargandoUltima ? (
            <p className="text-sm text-muted-foreground py-4">Cargando...</p>
          ) : (
            <ul className="divide-y">
              <li className="flex items-center justify-between gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Nombre capitán</span>
                <span>Última asignación</span>
              </li>
              {filasSinUsar.map(({ entidad, ultima }) => (
                <li key={entidad.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium">
                    {entidad.label}
                    {(indispPorCapitan.get(entidad.id) ?? []).map((txt) => (
                      <span key={txt} className="ml-2 inline-flex items-center gap-1 align-middle">
                        <span className="inline-block text-[9px] font-bold px-1 rounded bg-red-500/25 text-red-600 dark:text-red-300">
                          NO DISP
                        </span>
                        <span className="text-[11px] font-normal text-foreground/80">{txt}</span>
                      </span>
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {ultima ? format(parseISO(ultima), "EEE d MMM yyyy", { locale: es }) : "Sin registro"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!entidadAbierta} onOpenChange={(o) => !o && setDetalleAbiertoId(null)}>
        <DialogContent className="max-w-[95vw] w-fit max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {entidadAbierta?.label}
              {(entidadAbierta ? indispPorCapitan.get(entidadAbierta.id) ?? [] : []).map((txt) => (
                <span key={txt} className="ml-2 inline-flex items-center gap-1 align-middle">
                  <span className="inline-block text-[9px] font-bold px-1 rounded bg-red-500/25 text-red-600 dark:text-red-300">
                    NO DISP
                  </span>
                  <span className="text-xs font-normal text-foreground/80">{txt}</span>
                </span>
              ))}
            </DialogTitle>
          </DialogHeader>
          {entidadAbierta && renderCalendarios(detalleDe(entidadAbierta.id))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
