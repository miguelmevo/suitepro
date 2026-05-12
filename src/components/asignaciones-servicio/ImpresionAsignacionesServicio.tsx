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
}

const AUDIOVISUAL: TipoAsignacionServicio[] = ["audio","video","zoom","plataforma","pasillo_1","pasillo_2"];
const ACOMODADORES: TipoAsignacionServicio[] = ["acomodador_auditorio","acomodador_entrada_1","acomodador_entrada_2"];

export const ImpresionAsignacionesServicio = forwardRef<HTMLDivElement, Props>(
  ({ fechasReunion, tipos, asignaciones, participantes, grupos, congregacionNombre, mesAnio, colorTema = "blue" }, ref) => {
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
        return p ? `${p.nombre} ${p.apellido}` : "";
      }
      if (t.tipoCampo === "grupo" && a.grupo_predicacion_id) {
        const g = grupos.find((x) => x.id === a.grupo_predicacion_id);
        return g ? `Grupo ${g.numero}` : "";
      }
      return "";
    };

    const grupos3 = [
      { label: "Audiovisual", row: "#eef4ff", header: "#c7dcff", labelCell: "#dbe8ff", tipos: tipos.filter(t => AUDIOVISUAL.includes(t.value)) },
      { label: "Acomodadores", row: "#ecfdf5", header: "#bbf7d0", labelCell: "#d1fae5", tipos: tipos.filter(t => ACOMODADORES.includes(t.value)) },
      { label: "Aseo / Hospitalidad", row: "#fff7ed", header: "#fed7aa", labelCell: "#ffedd5", tipos: tipos.filter(t => t.value.startsWith("aseo_") || t.value === "hospitalidad") },
    ];

    return (
      <div ref={ref} className="impresion-asignaciones-servicio">
        <style>{`
          .impresion-asignaciones-servicio {
            width: 100%;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
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
          </thead>
          <tbody>
            {grupos3.map((g) => (
              <Fragment key={g.label}>
                {g.tipos.length > 0 && (
                  <tr>
                    <td className="ias-grp-header" style={{ background: g.header }}>{g.label}</td>
                    <td colSpan={fechasReunion.length} style={{ background: g.header }}></td>
                  </tr>
                )}
                {g.tipos.map((t) => (
                  <tr key={t.value} style={{ background: g.row }}>
                    <td className="ias-asig" style={{ background: g.labelCell }}>{t.label}</td>
                    {fechasReunion.map((dr) => {
                      const v = renderValor(dr.fecha, t, dr.dia_reunion);
                      return (
                        <td key={dr.fecha} className={!v ? "ias-empty" : ""}>
                          {v || "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

ImpresionAsignacionesServicio.displayName = "ImpresionAsignacionesServicio";
