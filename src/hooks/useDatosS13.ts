import { useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCatalogos } from "@/hooks/useCatalogos";

interface CicloRow {
  id: string;
  territorio_id: string;
  ciclo_numero: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  completado: boolean;
}

export const BLOCKS_PER_PAGE = 4;
export const ROWS_PER_PAGE = 20;

export const fmtS13 = (d?: string | null) => (d ? format(new Date(d + "T12:00:00"), "dd.MM.yyyy") : "");

export type BlockS13 = { asignado: string; inicio: string; fin: string };
export type FilaS13 = { numero: string; ultimaFecha: string; blocks: BlockS13[] };

/**
 * Datos del formulario S-13 ya calculados y paginados (20 territorios por hoja).
 * Los usan la vista previa/impresión y la descarga en PDF, para que ambas
 * salgan siempre iguales.
 */
export function useDatosS13(congregacionId: string, fechaInicio: string, fechaFin: string) {
  const { territorios: allTerritorios, isLoading: cargandoCatalogo } = useCatalogos();
  const territorios = useMemo(
    () =>
      allTerritorios
        .filter((t) => t.activo && /^\d+$/.test(t.numero.trim()))
        .sort((a, b) => parseInt(a.numero) - parseInt(b.numero)),
    [allTerritorios]
  );

  const { data: ciclos = [], isFetching: cargandoCiclos } = useQuery({
    queryKey: ["s13-ciclos", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ciclos_territorio")
        .select("id, territorio_id, ciclo_numero, fecha_inicio, fecha_fin, completado")
        .eq("congregacion_id", congregacionId)
        .order("fecha_inicio");
      if (error) throw error;
      return data as CicloRow[];
    },
    enabled: !!congregacionId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Solo ciclos completados. Sus fechas salen de las manzanas trabajadas
  // (primera y última), no de las fechas guardadas en el ciclo, que en los
  // ciclos importados no son las reales.
  const completados = useMemo(() => ciclos.filter((c) => c.completado), [ciclos]);

  const { data: datosCiclo = {}, isFetching: cargandoDatos } = useQuery({
    queryKey: ["s13-terminado-por", congregacionId, completados.length],
    queryFn: async () => {
      if (completados.length === 0) return {};
      const cicloIds = completados.map((c) => c.id);

      type Mt = { ciclo_id: string; marcado_por: string; fecha_trabajada: string };
      const mts: Mt[] = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase
          .from("manzanas_trabajadas")
          .select("ciclo_id, marcado_por, fecha_trabajada")
          .in("ciclo_id", cicloIds)
          .order("fecha_trabajada")
          .order("id")
          .range(desde, desde + 999);
        if (error) throw error;
        mts.push(...((data || []) as Mt[]));
        if (!data || data.length < 1000) break;
      }

      const porCiclo = new Map<string, { user: string; primera: string; ultima: string }>();
      mts.forEach((mt) => {
        const cur = porCiclo.get(mt.ciclo_id);
        if (!cur) {
          porCiclo.set(mt.ciclo_id, { user: mt.marcado_por, primera: mt.fecha_trabajada, ultima: mt.fecha_trabajada });
        } else {
          if (mt.fecha_trabajada < cur.primera) cur.primera = mt.fecha_trabajada;
          if (mt.fecha_trabajada >= cur.ultima) {
            cur.ultima = mt.fecha_trabajada;
            cur.user = mt.marcado_por;
          }
        }
      });

      const userIds = [...new Set([...porCiclo.values()].map((v) => v.user))];
      const { data: parts } = await supabase
        .from("participantes")
        .select("user_id, nombre, apellido")
        .in("user_id", userIds);
      const nameMap: Record<string, string> = {};
      (parts || []).forEach((p) => {
        if (p.user_id) nameMap[p.user_id] = `${p.apellido}, ${p.nombre}`;
      });

      // Fallback a profiles: quien registró puede ser un admin sin ficha de participante
      const faltantes = userIds.filter((id) => !nameMap[id]);
      if (faltantes.length > 0) {
        const { data: perfiles } = await supabase
          .from("profiles")
          .select("id, nombre, apellido")
          .in("id", faltantes);
        (perfiles || []).forEach((p) => {
          nameMap[p.id] = `${p.apellido || ""}, ${p.nombre || ""}`.trim();
        });
      }

      const result: Record<string, { nombre: string; inicio: string; fin: string }> = {};
      porCiclo.forEach((v, cicloId) => {
        result[cicloId] = { nombre: nameMap[v.user] || "", inicio: v.primera, fin: v.ultima };
      });
      return result;
    },
    enabled: completados.length > 0,
  });

  const flatRows: FilaS13[] = useMemo(() => {
    const rows: FilaS13[] = [];
    territorios.forEach((terr) => {
      // Solo ciclos completados, con las fechas reales de sus manzanas.
      const todosDelTerr = completados
        .filter((c) => c.territorio_id === terr.id)
        .map((c) => {
          const d = datosCiclo[c.id];
          return {
            id: c.id,
            inicio: d?.inicio ?? c.fecha_inicio,
            fin: d?.fin ?? c.fecha_fin ?? c.fecha_inicio,
            asignado: d?.nombre ?? "",
          };
        })
        .sort((a, b) => a.inicio.localeCompare(b.inicio));

      const previo = [...todosDelTerr]
        .filter((c) => c.fin < fechaInicio)
        .sort((a, b) => b.fin.localeCompare(a.fin))[0];

      const enPeriodo = todosDelTerr.filter(
        (c) => c.inicio >= fechaInicio && c.inicio <= fechaFin
      );

      const blocks: BlockS13[] = enPeriodo.map((c) => ({
        asignado: c.asignado,
        inicio: fmtS13(c.inicio),
        fin: fmtS13(c.fin),
      }));

      // Sin ciclo completado antes del período: vale la fecha del formulario anterior.
      let ultima = fmtS13(previo?.fin ?? terr.ultima_fecha_completado_inicial);
      if (blocks.length === 0) {
        rows.push({ numero: terr.numero, ultimaFecha: ultima, blocks: [] });
      } else {
        for (let i = 0; i < blocks.length; i += BLOCKS_PER_PAGE) {
          const chunk = blocks.slice(i, i + BLOCKS_PER_PAGE);
          rows.push({ numero: terr.numero, ultimaFecha: ultima, blocks: chunk });
          const lastFin = chunk[chunk.length - 1].fin;
          if (lastFin) ultima = lastFin;
        }
      }
    });
    return rows;
  }, [territorios, completados, datosCiclo, fechaInicio, fechaFin]);

  const paginated: FilaS13[][] = [];
  for (let i = 0; i < flatRows.length; i += ROWS_PER_PAGE) {
    paginated.push(flatRows.slice(i, i + ROWS_PER_PAGE));
  }
  if (paginated.length === 0) paginated.push([]);

  const periodoLabel = `${fmtS13(fechaInicio)} al ${fmtS13(fechaFin)}`;
  return { paginated, periodoLabel, cargando: cargandoCatalogo || cargandoCiclos || cargandoDatos };
}
