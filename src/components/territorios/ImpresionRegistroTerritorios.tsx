import { forwardRef, useMemo, Fragment } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCatalogos } from "@/hooks/useCatalogos";

interface Props {
  congregacionId: string;
  congregacionNombre: string;
  fechaInicio: string; // yyyy-MM-dd
  fechaFin: string; // yyyy-MM-dd
}

interface CicloRow {
  id: string;
  territorio_id: string;
  ciclo_numero: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  completado: boolean;
}

const BLOCKS_PER_PAGE = 4;
const ROWS_PER_PAGE = 20;

const fmt = (d?: string | null) => (d ? format(new Date(d + "T12:00:00"), "dd.MM.yyyy") : "");

export const ImpresionRegistroTerritorios = forwardRef<HTMLDivElement, Props>(
  ({ congregacionId, congregacionNombre, fechaInicio, fechaFin }, ref) => {
    const { territorios: allTerritorios } = useCatalogos();
    const territorios = useMemo(
      () =>
        allTerritorios
          .filter((t) => t.activo && /^\d+$/.test(t.numero.trim()))
          .sort((a, b) => parseInt(a.numero) - parseInt(b.numero)),
      [allTerritorios]
    );

    const { data: ciclos = [] } = useQuery({
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

    const { data: datosCiclo = {} } = useQuery({
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

    type Block = { asignado: string; inicio: string; fin: string };
    type TerritoryRow = { numero: string; ultimaFecha: string; blocks: Block[] };

    const flatRows: TerritoryRow[] = useMemo(() => {
      const rows: TerritoryRow[] = [];
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

        const blocks: Block[] = enPeriodo.map((c) => ({
          asignado: c.asignado,
          inicio: fmt(c.inicio),
          fin: fmt(c.fin),
        }));

        // Sin ciclo completado antes del período: vale la fecha del formulario anterior.
        let ultima = fmt(previo?.fin ?? terr.ultima_fecha_completado_inicial);
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

    const paginated: TerritoryRow[][] = [];
    for (let i = 0; i < flatRows.length; i += ROWS_PER_PAGE) {
      paginated.push(flatRows.slice(i, i + ROWS_PER_PAGE));
    }
    if (paginated.length === 0) paginated.push([]);

    const periodoLabel = `${fmt(fechaInicio)} al ${fmt(fechaFin)}`;
    const totalBlockCols = BLOCKS_PER_PAGE * 2;

    return (
      <div ref={ref} className="s13-print">
        <style>{`
          @media print {
            @page { size: letter portrait; margin: 8mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          .s13-print { font-family: Arial, Helvetica, sans-serif; color: #000; }
          .s13-page { page-break-after: always; padding: 4mm; }
          .s13-page:last-child { page-break-after: auto; }
          .s13-title { text-align: center; font-weight: bold; font-size: 14pt; letter-spacing: 0.5px; margin-bottom: 4px; }
          .s13-subtitle { text-align: center; font-size: 9pt; margin-bottom: 8px; }
          .s13-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .s13-table th, .s13-table td { border: 0.5px solid #000; padding: 2px 3px; font-size: 8pt; vertical-align: middle; }
          .s13-table th { background: #e8e8e8; font-weight: bold; text-align: center; font-size: 7.5pt; line-height: 1.1; }
          .s13-num { text-align: center; font-weight: bold; }
          .s13-ultima { text-align: center; font-size: 7.5pt; }
          .s13-asignado { text-align: center; font-size: 7.5pt; font-weight: 500; line-height: 1.1; word-break: break-word; }
          .s13-fecha { text-align: center; font-size: 7pt; }
          .s13-footer { display: flex; justify-content: space-between; margin-top: 6px; font-size: 7pt; color: #444; }
          .s13-note { font-size: 7pt; font-style: italic; margin-top: 4px; color: #333; }
        `}</style>

        {paginated.map((rows, pageIdx) => {
          const blockColWidth = (100 - 7 - 11) / totalBlockCols; // %
          return (
            <div key={pageIdx} className="s13-page">
              <div className="s13-title">REGISTRO DE ASIGNACIÓN DE TERRITORIO</div>
              <div className="s13-subtitle">
                Período: <strong>{periodoLabel}</strong> &nbsp;·&nbsp; Congregación: <strong>{congregacionNombre}</strong>
                {paginated.length > 1 && <> &nbsp;·&nbsp; Página {pageIdx + 1} de {paginated.length}</>}
              </div>

              <table className="s13-table">
                <colgroup>
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "11%" }} />
                  {Array.from({ length: totalBlockCols }).map((_, i) => (
                    <col key={i} style={{ width: `${blockColWidth}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2} className="s13-num">Núm. de terr.</th>
                    <th rowSpan={2} className="s13-ultima">Última fecha en que se completó*</th>
                    {Array.from({ length: BLOCKS_PER_PAGE }).map((_, i) => (
                      <th key={i} colSpan={2}>Asignado a</th>
                    ))}
                  </tr>
                  <tr>
                    {Array.from({ length: BLOCKS_PER_PAGE }).map((_, i) => (
                      <Fragment key={i}>
                        <th className="s13-fecha">Fecha en que se asignó</th>
                        <th className="s13-fecha">Fecha en que se completó</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <Fragment key={`row-${idx}`}>
                      <tr style={{ height: "14px" }}>
                        <td rowSpan={2} className="s13-num">{row.numero}</td>
                        <td rowSpan={2} className="s13-ultima">{row.ultimaFecha}</td>
                        {Array.from({ length: BLOCKS_PER_PAGE }).map((_, bi) => {
                          const b = row.blocks[bi];
                          return (
                            <td key={bi} colSpan={2} className="s13-asignado">{b?.asignado || "\u00a0"}</td>
                          );
                        })}
                      </tr>
                      <tr style={{ height: "14px" }}>
                        {Array.from({ length: BLOCKS_PER_PAGE }).map((_, bi) => {
                          const b = row.blocks[bi];
                          return (
                            <Fragment key={bi}>
                              <td className="s13-fecha">{b?.inicio || "\u00a0"}</td>
                              <td className="s13-fecha">{b?.fin || "\u00a0"}</td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    </Fragment>
                  ))}
                  {Array.from({ length: Math.max(0, ROWS_PER_PAGE - rows.length) }).map((_, i) => (
                    <Fragment key={`empty-${i}`}>
                      <tr style={{ height: "14px" }}>
                        <td rowSpan={2} className="s13-num">&nbsp;</td>
                        <td rowSpan={2} className="s13-ultima">&nbsp;</td>
                        {Array.from({ length: BLOCKS_PER_PAGE }).map((_, bi) => (
                          <td key={bi} colSpan={2}>&nbsp;</td>
                        ))}
                      </tr>
                      <tr style={{ height: "14px" }}>
                        {Array.from({ length: BLOCKS_PER_PAGE }).map((_, bi) => (
                          <Fragment key={bi}>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                          </Fragment>
                        ))}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>

              <div className="s13-note">
                * Última fecha en que el territorio se completó antes del período seleccionado (o, en páginas de continuación, la última fecha mostrada en la página anterior).
              </div>
              <div className="s13-footer">
                <span>S-13-S</span>
                <span>{congregacionNombre}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

ImpresionRegistroTerritorios.displayName = "ImpresionRegistroTerritorios";
