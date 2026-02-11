import { forwardRef } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ProgramaReunionPublica } from "@/hooks/useReunionPublica";
import { Participante } from "@/types/grupos-servicio";
import { getColorTheme } from "@/lib/congregation-colors";

interface ImpresionReunionPublicaProps {
  programa: ProgramaReunionPublica[];
  participantes: Participante[];
  fechas: Date[];
  congregacionNombre: string;
  mesAnio: string;
  colorTema?: string;
}

export const ImpresionReunionPublica = forwardRef<HTMLDivElement, ImpresionReunionPublicaProps>(
  ({ programa, participantes, fechas, congregacionNombre, mesAnio, colorTema = "blue" }, ref) => {
    const theme = getColorTheme(colorTema);
    const pdf = theme.pdf;

    const getNombre = (id: string | null) => {
      if (!id) return "";
      const p = participantes.find(part => part.id === id);
      return p ? `${p.nombre} ${p.apellido}` : "";
    };

    const getProgramaFecha = (fecha: string) => {
      return programa.find(p => p.fecha === fecha);
    };

    return (
      <div ref={ref} className="impresion-reunion-publica">
        <style>{`
          .impresion-reunion-publica {
            width: auto;
            max-width: 520px;
            margin: 0 auto;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            color: #222;
            background: white;
          }

          @media print {
            .impresion-reunion-publica {
              width: auto;
              max-width: 520px;
              margin: 0 auto;
              padding: 0;
            }
            @page {
              size: letter portrait;
              margin: 10mm 12mm;
            }
          }

          .irp-titulo {
            background: ${pdf.headerDark};
            color: white;
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            padding: 8px 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-radius: 2px 2px 0 0;
          }

          .irp-fecha-header {
            background: ${pdf.headerLight};
            color: white;
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            padding: 5px 8px;
            border-top: 2px solid ${pdf.headerDark};
          }

          .irp-bloque {
            margin-bottom: 0;
          }

          .irp-tabla {
            width: 100%;
            border-collapse: collapse;
          }

          .irp-tabla td {
            padding: 3px 8px;
            vertical-align: top;
            border-bottom: 1px solid #e5e5e5;
            font-size: 10.5px;
            line-height: 1.4;
          }

          .irp-tabla tr:last-child td {
            border-bottom: none;
          }

          .irp-label {
            width: 140px;
            font-weight: bold;
            color: #444;
          }

          .irp-label-italic {
            width: 140px;
            font-weight: bold;
            color: #444;
          }

          .irp-value {
            font-weight: normal;
          }

          .irp-tema {
            font-weight: bold;
          }

          .irp-congregacion {
            margin-left: 20px;
            color: #555;
            font-weight: bold;
          }

          .irp-bloque-wrapper {
            border: 1px solid #ddd;
            border-top: none;
            margin-bottom: 8px;
          }

          .irp-bloque-wrapper:first-of-type {
            border-top: 1px solid #ddd;
          }
        `}</style>

        <div className="irp-titulo">
          PROGRAMA REUNIÓN PÚBLICA {congregacionNombre.toUpperCase()} - {mesAnio.toUpperCase()}
        </div>

        {fechas.map((fecha) => {
          const fechaStr = format(fecha, "yyyy-MM-dd");
          const prog = getProgramaFecha(fechaStr);
          const fechaLabel = format(fecha, "EEEE dd 'de' MMMM", { locale: es });
          // Capitalize first letter
          const fechaCapitalized = fechaLabel.charAt(0).toUpperCase() + fechaLabel.slice(1);

          const presidente = getNombre(prog?.presidente_id || null);
          const orador = prog?.orador_nombre || "";
          const oradorCongregacion = (prog as any)?.orador_congregacion || "";
          const tema = prog?.tema_discurso || "";
          const lector = getNombre(prog?.lector_atalaya_id || null);

          return (
            <div key={fechaStr} className="irp-bloque-wrapper">
              <div className="irp-fecha-header">{fechaCapitalized}</div>
              <table className="irp-tabla">
                <tbody>
                  <tr>
                    <td className="irp-label">Presidente:</td>
                    <td className="irp-value">{presidente}</td>
                  </tr>
                  <tr>
                    <td className="irp-label">Orador:</td>
                    <td className="irp-value">
                      {orador}
                      {oradorCongregacion && (
                        <span className="irp-congregacion">
                          Congregacion: {oradorCongregacion}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="irp-label">Tema:</td>
                    <td className="irp-value irp-tema">{tema}</td>
                  </tr>
                  <tr>
                    <td className="irp-label-italic">Lector de La Atalaya :</td>
                    <td className="irp-value">{lector}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  }
);

ImpresionReunionPublica.displayName = "ImpresionReunionPublica";
