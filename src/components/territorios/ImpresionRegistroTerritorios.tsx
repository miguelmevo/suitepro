import { forwardRef, Fragment } from "react";
import { BLOCKS_PER_PAGE, ROWS_PER_PAGE, useDatosS13 } from "@/hooks/useDatosS13";

interface Props {
  congregacionId: string;
  congregacionNombre: string;
  fechaInicio: string; // yyyy-MM-dd
  fechaFin: string; // yyyy-MM-dd
}

export const ImpresionRegistroTerritorios = forwardRef<HTMLDivElement, Props>(
  ({ congregacionId, congregacionNombre, fechaInicio, fechaFin }, ref) => {
    const { paginated, periodoLabel } = useDatosS13(congregacionId, fechaInicio, fechaFin);
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
