import { forwardRef, Fragment } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { getColorTheme } from "@/lib/congregation-colors";
import type { AsignacionServicio, TipoAsignacionServicio } from "@/hooks/useAsignacionesServicio";

interface TipoCfg {
  value: TipoAsignacionServicio;
  label: string;
  tipoCampo: "individual" | "grupo";
  soloFinSemana?: boolean;
}

interface Props {
  fechasReunion: { fecha: string; dia_reunion: "entre_semana" | "fin_semana" }[];
  tipos: TipoCfg[];
  asignaciones: AsignacionServicio[];
  participantes: { id: string; nombre: string; apellido: string }[];
  grupos: { id: string; numero: number }[];
  congregacionNombre: string;
  mesAnio: string;
  colorTema?: string;
  diasEspeciales?: { fecha: string; mensaje: string; color: string }[];
  mensajesAdicionales?: { id: string; fecha: string; mensaje: string; color: string }[];
}

const AUDIOVISUAL: TipoAsignacionServicio[] = ["audio","video","zoom","plataforma","pasillo_1","pasillo_2"];
const ACOMODADORES: TipoAsignacionServicio[] = ["acomodador_auditorio","acomodador_entrada_1","acomodador_entrada_2"];

export const ImpresionAsignacionesServicio = forwardRef<HTMLDivElement, Props>(
  ({ fechasReunion, tipos, asignaciones, participantes, grupos, congregacionNombre, mesAnio, colorTema = "blue", diasEspeciales = [], mensajesAdicionales = [] }, ref) => {
    const especialPorFecha = new Map<string, { mensaje: string; color: string }>();
    diasEspeciales.forEach((d) => especialPorFecha.set(d.fecha, { mensaje: d.mensaje, color: d.color }));
    const mensajePorFecha = new Map<string, { mensaje: string; color: string }>();
    mensajesAdicionales.forEach((m) => mensajePorFecha.set(m.fecha, { mensaje: m.mensaje, color: m.color }));
    const hayMensajes = mensajesAdicionales.length > 0;
    const theme = getColorTheme(colorTema);
    const pdf = theme.pdf;

    const byKey = new Map<string, AsignacionServicio>();
    asignaciones.forEach((a) => byKey.set(`${a.fecha}__${a.tipo_asignacion}`, a));

    const nombreCongregacionTitle = congregacionNombre
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    const renderValor = (fecha: string, t: TipoCfg, dr: "entre_semana" | "fin_semana") => {
      if (t.soloFinSemana && dr !== "fin_semana") return "—";
      const a = byKey.get(`${fecha}__${t.value}`);
      if (!a) return "";
      if (t.tipoCampo === "individual" && a.participante_id) {
        const p = participantes.find((x) => x.id === a.participante_id);
        return p ? `${p.nombre} ${p.apellido}`.toUpperCase() : "";
      }
      if (t.tipoCampo === "grupo" && a.grupo_predicacion_id) {
        const g = grupos.find((x) => x.id === a.grupo_predicacion_id);
        return g ? `Grupo ${g.numero}` : "";
      }
      return "";
    };

    const ZEBRA_GREEN = "#86efac";
    const GROUP_HEADER_BG = "#bbf7d0";
    const GROUP_LABEL_BG = "#d1fae5";
    const grupos3 = [
      { label: "Audiovisual", tipos: tipos.filter(t => AUDIOVISUAL.includes(t.value)) },
      { label: "Acomodadores", tipos: tipos.filter(t => ACOMODADORES.includes(t.value)) },
      { label: "Aseo / Hospitalidad", tipos: tipos.filter(t => t.value.startsWith("aseo_") || t.value === "hospitalidad") },
    ];

    return (
      <div ref={ref} className="impresion-asignaciones-servicio">
        <style>{`
          .impresion-asignaciones-servicio {
            width: 100%;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9.5px;
            color: #222;
            background: white;
          }
          @media print {
            @page { size: letter landscape; margin: 8mm 10mm; }
          }
          .ias-titulo {
            background: ${pdf.headerDark};
            color: white;
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            padding: 8px 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-radius: 4px;
            margin-bottom: 8px;
          }
          table.ias-tabla {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid ${pdf.headerDark};
          }
          .ias-tabla th {
            background: ${pdf.headerLight};
            color: white;
            font-size: 9.5px;
            font-weight: bold;
            padding: 5px 4px;
            border: 1px solid ${pdf.headerDark};
            text-align: center;
            vertical-align: middle;
          }
          .ias-tabla td {
            padding: 4px 5px;
            border: 1px solid #ccc;
            font-size: 10px;
            vertical-align: middle;
            text-align: center;
          }
          .ias-asig {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9px;
            text-align: left;
            white-space: nowrap;
          }
          .ias-grp-header {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10px;
            text-align: left;
            letter-spacing: 0.5px;
          }
          .ias-empty { color: #aaa; font-style: italic; }
        `}</style>

        <div className="ias-titulo">
          ASIGNACIONES DE SERVICIO {nombreCongregacionTitle ? `- ${nombreCongregacionTitle} ` : ""}
          - {mesAnio.toUpperCase()}
        </div>

        <table className="ias-tabla">
          <thead>
            <tr>
              <th style={{ width: 160, textAlign: "left" }}>Asignación</th>
              {fechasReunion.map((dr) => (
                <th key={dr.fecha}>
                  {format(parseISO(dr.fecha), "EEE d MMM", { locale: es })}
                </th>
              ))}
            </tr>
            {hayMensajes && (
              <tr>
                <th style={{ background: "#fff", border: "none" }}></th>
                {fechasReunion.map((dr) => {
                  const m = mensajePorFecha.get(dr.fecha);
                  if (!m) return <th key={dr.fecha} style={{ background: "#fff", border: "none" }}></th>;
                  return (
                    <th
                      key={dr.fecha}
                      style={{
                        background: m.color,
                        color: "#fff",
                        fontSize: 9,
                        padding: "4px 3px",
                        textTransform: "uppercase",
                        letterSpacing: 0.2,
                        lineHeight: 1.2,
                      }}
                    >
                      {m.mensaje}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {(() => {
              const firstNonEmptyIdx = grupos3.findIndex((g) => g.tipos.length > 0);
              let rowSpanCount = 0;
              grupos3.forEach((g, gIdx) => {
                if (firstNonEmptyIdx < 0) return;
                if (gIdx < firstNonEmptyIdx) return;
                if (gIdx === firstNonEmptyIdx) rowSpanCount += g.tipos.length;
                else {
                  if (g.tipos.length > 0) rowSpanCount += 1;
                  rowSpanCount += g.tipos.length;
                }
              });
              let dataRowIdx = -1;
              return grupos3.map((g, gIdx) => (
                <Fragment key={g.label}>
                  {g.tipos.length > 0 && (
                    <tr>
                      <td className="ias-grp-header" style={{ background: GROUP_HEADER_BG }}>{g.label}</td>
                      <td colSpan={fechasReunion.length} style={{ background: GROUP_HEADER_BG }}></td>
                    </tr>
                  )}
                  {g.tipos.map((t, tIdx) => {
                    dataRowIdx += 1;
                    const rowBg = dataRowIdx % 2 === 0 ? "#ffffff" : ZEBRA_GREEN;
                    return (
                    <tr key={t.value} style={{ background: rowBg }}>
                      <td className="ias-asig" style={{ background: GROUP_LABEL_BG }}>{t.label}</td>
                      {fechasReunion.map((dr) => {
                        const esp = especialPorFecha.get(dr.fecha);
                        if (esp) {
                          if (gIdx === firstNonEmptyIdx && tIdx === 0) {
                            return (
                              <td
                                key={dr.fecha}
                                rowSpan={rowSpanCount}
                                style={{ background: esp.color, color: "#fff", fontWeight: "bold", textTransform: "uppercase", textAlign: "center", verticalAlign: "middle", fontSize: 11 }}
                              >
                                {esp.mensaje}
                              </td>
                            );
                          }
                          return null;
                        }
                        const v = renderValor(dr.fecha, t, dr.dia_reunion);
                        return (
                          <td key={dr.fecha} className={!v ? "ias-empty" : ""}>
                            {v || "—"}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </Fragment>
              ));
            })()}
          </tbody>
        </table>
      </div>
    );
  }
);

ImpresionAsignacionesServicio.displayName = "ImpresionAsignacionesServicio";
