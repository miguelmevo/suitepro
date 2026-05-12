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
  diasEspeciales?: { fecha: string; mensaje: string; color: string }[];
}

// Orden y agrupación de columnas para el formato vertical
const ACOMODADORES: TipoAsignacionServicio[] = ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"];
const MICROFONOS: TipoAsignacionServicio[] = ["plataforma", "pasillo_1", "pasillo_2"];
const AUDIOVIDEO: TipoAsignacionServicio[] = ["audio", "video", "zoom"];
const ASEO: TipoAsignacionServicio[] = ["aseo_1", "aseo_2"];
const HOSPITALIDAD: TipoAsignacionServicio[] = ["hospitalidad"];

export const ImpresionAsignacionesServicioVertical = forwardRef<HTMLDivElement, Props>(
  ({ fechasReunion, tipos, asignaciones, participantes, grupos, congregacionNombre, mesAnio, colorTema = "blue", diasEspeciales = [] }, ref) => {
    const especialPorFecha = new Map<string, { mensaje: string; color: string }>();
    diasEspeciales.forEach((d) => especialPorFecha.set(d.fecha, { mensaje: d.mensaje, color: d.color }));
    const theme = getColorTheme(colorTema);
    const pdf = theme.pdf;

    const byKey = new Map<string, AsignacionServicio>();
    asignaciones.forEach((a) => byKey.set(`${a.fecha}__${a.tipo_asignacion}`, a));

    const tipoMap = new Map(tipos.map((t) => [t.value, t]));
    const filterPresent = (vals: TipoAsignacionServicio[]) => vals.filter((v) => tipoMap.has(v));

    // Cada "grupo" tiene columnas; cada columna puede agrupar varios tipos (se apilan en una misma celda)
    const buildCol = (label: string, vals: TipoAsignacionServicio[]) => {
      const present = vals.filter((v) => tipoMap.has(v));
      return present.length > 0 ? { label, tipos: present } : null;
    };

    const grupos5 = [
      {
        label: "ACOMODADORES",
        columnas: [
          buildCol("AUDITORIO", ["acomodador_auditorio"]),
          buildCol("ENTRADA", ["acomodador_entrada_1", "acomodador_entrada_2"]),
        ].filter(Boolean) as { label: string; tipos: TipoAsignacionServicio[] }[],
      },
      {
        label: "MICRÓFONOS",
        columnas: [
          buildCol("PLATAFORMA", ["plataforma"]),
          buildCol("PASILLOS", ["pasillo_1", "pasillo_2"]),
        ].filter(Boolean) as { label: string; tipos: TipoAsignacionServicio[] }[],
      },
      {
        label: "AUDIO Y VIDEO",
        columnas: [
          buildCol("AUDIO", ["audio"]),
          buildCol("VIDEO", ["video"]),
          buildCol("ZOOM", ["zoom"]),
        ].filter(Boolean) as { label: string; tipos: TipoAsignacionServicio[] }[],
      },
      {
        label: "ASEO",
        columnas: [
          buildCol("ASEO", ["aseo_1", "aseo_2"]),
        ].filter(Boolean) as { label: string; tipos: TipoAsignacionServicio[] }[],
      },
      {
        label: "HOSPITALIDAD",
        columnas: [
          buildCol("HOSPITALIDAD", ["hospitalidad"]),
        ].filter(Boolean) as { label: string; tipos: TipoAsignacionServicio[] }[],
      },
    ].filter((g) => g.columnas.length > 0);

    const totalCols = 1 + grupos5.reduce((s, g) => s + g.columnas.length, 0);

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
        return g ? `G${g.numero}` : "";
      }
      return "";
    };

    return (
      <div ref={ref} className="impresion-asignaciones-vertical">
        <style>{`
          .impresion-asignaciones-vertical {
            width: 100%;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            color: #222;
            background: white;
          }
          @media print {
            @page { size: letter portrait; margin: 8mm 8mm; }
          }
          .iav-titulo {
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
          table.iav-tabla {
            width: 100%;
            border-collapse: collapse;
            border: 0.1px solid ${pdf.headerLight};
          }
          .iav-tabla th, .iav-tabla td {
            border: 0.1px solid ${pdf.headerLight};
            padding: 8px 4px;
            font-size: 8.5px;
            text-align: center;
            vertical-align: middle;
          }
          .iav-grupo {
            color: #fff;
            font-weight: bold;
            text-transform: uppercase;
            background: ${pdf.headerDark};
            font-size: 6.5px;
            letter-spacing: 0.3px;
            padding: 4px 3px;
          }
          .iav-subhead {
            background: ${pdf.headerLight};
            color: #fff;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 6px;
            padding: 3px 2px;
          }
          .iav-dia {
            font-weight: bold;
            text-transform: uppercase;
            color: ${pdf.headerDark};
            white-space: nowrap;
            font-size: 9px;
            line-height: 1.25;
          }
          .iav-row-a .iav-dia,
          .iav-row-a td:not(.iav-dia) { background: ${pdf.rowAlt}; }
          .iav-row-b .iav-dia,
          .iav-row-b td:not(.iav-dia) { background: #ffffff; }
          .iav-empty { color: #999; }
          .iav-vsc {
            font-size: 8px;
            color: #b91c1c;
            font-weight: bold;
            display: block;
          }
        `}</style>

        <div className="iav-titulo">
          PROGRAMA DE PRIVILEGIOS{nombreCongregacionTitle ? ` ${nombreCongregacionTitle.toUpperCase()}` : ""}
          <br />
          {mesAnio.toUpperCase()}
        </div>

        <table className="iav-tabla">
          <thead>
            <tr>
              <th rowSpan={2} className="iav-grupo" style={{ width: 80 }}>DÍA</th>
              {grupos5.map((g) => (
                <th key={g.label} colSpan={g.tipos.length} className="iav-grupo" style={{ background: pdf.headerDark }}>
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {grupos5.flatMap((g) =>
                g.tipos.map((tv) => {
                  const t = tipoMap.get(tv)!;
                  return (
                    <th key={tv} className="iav-subhead">
                      {t.label.replace(/\s*#\d+/g, "").toUpperCase()}
                    </th>
                  );
                })
              )}
            </tr>
          </thead>
          <tbody>
            {fechasReunion.map((dr, idx) => {
              const esp = especialPorFecha.get(dr.fecha);
              const fechaObj = parseISO(dr.fecha);
              const diaNombre = format(fechaObj, "EEEE", { locale: es }).toUpperCase();
              const diaNum = format(fechaObj, "dd");
              return (
                <tr key={dr.fecha} className={idx % 2 === 0 ? "iav-row-a" : "iav-row-b"}>
                  <td className="iav-dia">
                    {diaNombre}
                    <br />
                    {diaNum}
                  </td>
                  {esp ? (
                    <td
                      colSpan={totalCols - 1}
                      style={{
                        background: esp.color,
                        color: "#fff",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        fontSize: 11,
                      }}
                    >
                      {esp.mensaje}
                    </td>
                  ) : (
                    grupos5.flatMap((g) =>
                      g.tipos.map((tv) => {
                        const t = tipoMap.get(tv)!;
                        const v = renderValor(dr.fecha, t, dr.dia_reunion);
                        return (
                          <td key={tv} className={!v ? "iav-empty" : ""}>
                            {v || "—"}
                          </td>
                        );
                      })
                    )
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);

ImpresionAsignacionesServicioVertical.displayName = "ImpresionAsignacionesServicioVertical";
