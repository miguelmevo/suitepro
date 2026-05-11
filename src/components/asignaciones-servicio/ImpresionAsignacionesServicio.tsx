import { forwardRef } from "react";
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
}

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
          }
          .ias-tabla tr.zebra td { background: #f6f7fb; }
          .ias-fecha {
            font-weight: bold;
            text-align: center;
            white-space: nowrap;
            background: #eef1f7 !important;
          }
          .ias-empty { color: #aaa; font-style: italic; text-align: center; }
        `}</style>

        <div className="ias-titulo">
          ASIGNACIONES DE SERVICIO {nombreCongregacionTitle ? `- ${nombreCongregacionTitle} ` : ""}
          - {mesAnio.toUpperCase()}
        </div>

        <table className="ias-tabla">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Fecha</th>
              {tipos.map((t) => (
                <th key={t.value}>{t.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fechasReunion.map((dr, idx) => (
              <tr key={dr.fecha} className={idx % 2 === 1 ? "zebra" : ""}>
                <td className="ias-fecha">
                  {format(parseISO(dr.fecha), "EEE d MMM", { locale: es })}
                </td>
                {tipos.map((t) => {
                  const v = renderValor(dr.fecha, t, dr.dia_reunion);
                  return (
                    <td key={t.value} className={!v ? "ias-empty" : ""}>
                      {v || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

ImpresionAsignacionesServicio.displayName = "ImpresionAsignacionesServicio";
