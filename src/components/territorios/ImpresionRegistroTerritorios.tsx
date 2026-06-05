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
}

const BLOCKS_PER_PAGE = 4;
const ROWS_PER_PAGE = 22;

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
          .select("id, territorio_id, ciclo_numero, fecha_inicio, fecha_fin")
          .eq("congregacion_id", congregacionId)
          .order("fecha_inicio");
        if (error) throw error;
        return data as CicloRow[];
      },
      enabled: !!congregacionId,
    });

    const { data: terminadoPor = {} } = useQuery({
      queryKey: ["s13-terminado-por", congregacionId, ciclos.length],
      queryFn: async () => {
        if (ciclos.length === 0) return {};
        const cicloIds = ciclos.map((c) => c.id);
        const { data: mts, error } = await supabase
          .from("manzanas_trabajadas")
          .select("ciclo_id, marcado_por, fecha_trabajada")
          .in("ciclo_id", cicloIds)
          .order("fecha_trabajada");
        if (error) throw error;

        const lastByCiclo = new Map<string, { user: string; date: string }>();
        (mts || []).forEach((mt) => {
          const cur = lastByCiclo.get(mt.ciclo_id);
          if (!cur || mt.fecha_trabajada >= cur.date) {
            lastByCiclo.set(mt.ciclo_id, { user: mt.marcado_por, date: mt.fecha_trabajada });
          }
        });

        const userIds = [...new Set([...lastByCiclo.values()].map((v) => v.user))];
        const { data: parts } = await supabase
          .from("participantes")
          .select("user_id, nombre, apellido")
          .in("user_id", userIds);
        const nameMap: Record<string, string> = {};
        (parts || []).forEach((p) => {
          if (p.user_id) nameMap[p.user_id] = `${p.apellido}, ${p.nombre}`;
        });

        const result: Record<string, string> = {};
        lastByCiclo.forEach((v, cicloId) => {
          result[cicloId] = nameMap[v.user] || "";
        });
        return result;
      },
      enabled: ciclos.length > 0,
    });

    type Block = { asignado: string; inicio: string; fin: string };
    type TerritoryRow = { numero: string; ultimaFecha: string; blocks: Block[] };

    const flatRows: TerritoryRow[] = useMemo(() => {
      const rows: TerritoryRow[] = [];
      territorios.forEach((terr) => {
        const todosDelTerr = ciclos
          .filter((c) => c.territorio_id === terr.id)
          .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));

        const previo = [...todosDelTerr]
          .filter((c) => c.fecha_fin && c.fecha_fin < fechaInicio)
          .sort((a, b) => (b.fecha_fin || "").localeCompare(a.fecha_fin || ""))[0];

        const enPeriodo = todosDelTerr.filter(
          (c) => c.fecha_inicio >= fechaInicio && c.fecha_inicio <= fechaFin
        );

        const blocks: Block[] = enPeriodo.map((c) => ({
          asignado: c.fecha_fin ? terminadoPor[c.id] || "" : "",
          inicio: fmt(c.fecha_inicio),
          fin: fmt(c.fecha_fin),
        }));

        let ultima = fmt(previo?.fecha_fin);
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
    }, [territorios, ciclos, terminadoPor, fechaInicio, fechaFin]);

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
                      <>
                        <th key={`a-${i}`} className="s13-fecha">Fecha en que se asignó</th>
                        <th key={`b-${i}`} className="s13-fecha">Fecha en que se completó</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <>
                      <tr key={`name-${idx}`}>
                        <td rowSpan={2} className="s13-num">{row.numero}</td>
                        <td rowSpan={2} className="s13-ultima">{row.ultimaFecha}</td>
                        {Array.from({ length: BLOCKS_PER_PAGE }).map((_, bi) => {
                          const b = row.blocks[bi];
                          return (
                            <td key={bi} colSpan={2} className="s13-asignado">{b?.asignado || ""}</td>
                          );
                        })}
                      </tr>
                      <tr key={`dates-${idx}`}>
                        {Array.from({ length: BLOCKS_PER_PAGE }).map((_, bi) => {
                          const b = row.blocks[bi];
                          return (
                            <>
                              <td key={`i-${bi}`} className="s13-fecha">{b?.inicio || ""}</td>
                              <td key={`f-${bi}`} className="s13-fecha">{b?.fin || ""}</td>
                            </>
                          );
                        })}
                      </tr>
                    </>
                  ))}
                  {Array.from({ length: Math.max(0, ROWS_PER_PAGE - rows.length) }).map((_, i) => (
                    <>
                      <tr key={`en-${i}`} style={{ height: "14px" }}>
                        <td rowSpan={2} className="s13-num">&nbsp;</td>
                        <td rowSpan={2} className="s13-ultima">&nbsp;</td>
                        {Array.from({ length: BLOCKS_PER_PAGE }).map((_, bi) => (
                          <td key={bi} colSpan={2}>&nbsp;</td>
                        ))}
                      </tr>
                      <tr key={`ed-${i}`} style={{ height: "14px" }}>
                        {Array.from({ length: BLOCKS_PER_PAGE }).map((_, bi) => (
                          <>
                            <td key={`ei-${bi}`}>&nbsp;</td>
                            <td key={`ef-${bi}`}>&nbsp;</td>
                          </>
                        ))}
                      </tr>
                    </>
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
