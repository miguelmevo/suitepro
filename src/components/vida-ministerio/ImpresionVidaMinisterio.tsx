import { forwardRef } from "react";
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import type { ProgramaVidaMinisterio } from "@/types/vida-ministerio";
import type { Participante } from "@/types/grupos-servicio";

interface Props {
  programas: ProgramaVidaMinisterio[];
  participantes: Participante[];
  congregacionNombre: string;
  mesAnio: string;
  horaInicio?: string;
}

// Colores fijos por sección
const COLOR_TESOROS = "#575A5C";
const COLOR_MAESTROS = "#BF8900";
const COLOR_VIDA = "#7E0023";

// Elimina sufijos tipo "(10 min.)" / "(10 mins.)" / "(1 min)" al final del título
function limpiarTitulo(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s*\(\s*\d+\s*mins?\.?\s*\)\s*$/i, "").trim();
}

function addMins(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export const ImpresionVidaMinisterio = forwardRef<HTMLDivElement, Props>(
  ({ programas, participantes, congregacionNombre, mesAnio, horaInicio = "19:30" }, ref) => {
    const getNombre = (id: string | null | undefined) => {
      if (!id) return "—";
      const p = participantes.find((x) => x.id === id);
      return p ? `${p.nombre} ${p.apellido}` : "—";
    };

    const chunks: ProgramaVidaMinisterio[][] = [];
    for (let i = 0; i < programas.length; i += 2) {
      chunks.push(programas.slice(i, i + 2));
    }

    const renderSemana = (programa: ProgramaVidaMinisterio) => {
      const fechaMartes = addDays(parseISO(programa.fecha_semana), 1);
      const diaMes = format(fechaMartes, "d 'de' MMMM", { locale: es });
      const lecturaSemana = programa.lectura_semana || "";

      let t = horaInicio;
      const tCancionInicial = t; t = addMins(t, 5);
      const tPalabras = t; t = addMins(t, 1);

      const tT1 = t; t = addMins(t, 10);
      const tT2 = t; t = addMins(t, 10);
      const tT3 = t; t = addMins(t, 4);

      const maestros = programa.maestros || [];
      const maestroTimes: string[] = [];
      const defaultDurs = maestros.length === 4 ? [1, 3, 3, 5] : maestros.length === 3 ? [3, 3, 5] : Array(maestros.length).fill(4);
      maestros.forEach((_, i) => {
        maestroTimes.push(t);
        t = addMins(t, defaultDurs[i] ?? 4);
      });

      const tCancionInter = t; t = addMins(t, 5);

      const vidaPartes = programa.vida_cristiana || [];
      const vidaTimes: string[] = [];
      let vidaDurs: number[];
      if (vidaPartes.length === 2) vidaDurs = [10, 5];
      else if (vidaPartes.length === 1) vidaDurs = [15];
      else if (vidaPartes.length === 3) vidaDurs = [10, 5, 5];
      else vidaDurs = Array(vidaPartes.length).fill(5);
      vidaPartes.forEach((_, i) => {
        vidaTimes.push(t);
        t = addMins(t, vidaDurs[i] ?? 5);
      });

      const tEstudio = t; t = addMins(t, 30);
      const tConclusion = t; t = addMins(t, 3);
      const tCancionFinal = t;

      const numStartMaestros = 4;
      const numStartVida = numStartMaestros + maestros.length;
      const numEstudio = numStartVida + vidaPartes.length;

      return (
        <div className="vym-semana" key={programa.id}>
          {/* Encabezado de semana */}
          <table className="vym-header">
            <tbody>
              <tr>
                <td className="vym-fecha">
                  <span>{diaMes.toUpperCase()}</span>
                  {lecturaSemana && (
                    <span className="vym-fecha-lectura"> | {lecturaSemana.toUpperCase()}</span>
                  )}
                </td>
                <td className="vym-presi">
                  <div><span className="vym-lbl">Presidente:</span> <span className="vym-val">{getNombre(programa.presidente_id)}</span></div>
                  <div><span className="vym-lbl">Oración:</span> <span className="vym-val">{getNombre(programa.oracion_inicial_id)}</span></div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Filas iniciales */}
          <table className="vym-tabla">
            <colgroup>
              <col style={{ width: "44px" }} />
              <col />
              <col style={{ width: "230px" }} />
            </colgroup>
            <tbody>
              <tr>
                <td className="vym-hora">{tCancionInicial}</td>
                <td className="vym-titulo">• Canción {programa.cantico_inicial ?? "—"} (5 mins.)</td>
                <td></td>
              </tr>
              <tr>
                <td className="vym-hora">{tPalabras}</td>
                <td className="vym-titulo">• Palabras de introducción (1 min.)</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          {/* TESOROS */}
          <div className="vym-section" style={{ background: COLOR_TESOROS }}>
            <span className="vym-section-title">TESOROS DE LA BIBLIA</span>
            <span className="vym-section-aux">Auditorio principal</span>
          </div>
          <table className="vym-tabla">
            <colgroup>
              <col style={{ width: "44px" }} />
              <col />
              <col style={{ width: "230px" }} />
            </colgroup>
            <tbody>
              <tr>
                <td className="vym-hora">{tT1}</td>
                <td className="vym-titulo">1. {programa.tesoros?.titulo || "Discurso Tesoros"} (10 mins.)</td>
                <td className="vym-part">{getNombre(programa.tesoros?.participante_id)}</td>
              </tr>
              <tr>
                <td className="vym-hora">{tT2}</td>
                <td className="vym-titulo">2. Busquemos perlas escondidas (10 mins.)</td>
                <td className="vym-part">{getNombre(programa.perlas_id)}</td>
              </tr>
              <tr>
                <td className="vym-hora">{tT3}</td>
                <td className="vym-titulo">3. Lectura de la Biblia{programa.lectura_biblica?.cita ? ` (${programa.lectura_biblica.cita})` : ""} (4 mins.)</td>
                <td className="vym-part">{getNombre(programa.lectura_biblica?.participante_id)}</td>
              </tr>
            </tbody>
          </table>

          {/* SEAMOS MEJORES MAESTROS */}
          {maestros.length > 0 && (
            <>
              <div className="vym-section" style={{ background: COLOR_MAESTROS }}>
                <span className="vym-section-title">SEAMOS MEJORES MAESTROS</span>
                <span className="vym-section-aux">Auditorio principal</span>
              </div>
              <table className="vym-tabla">
                <colgroup>
                  <col style={{ width: "44px" }} />
                  <col />
                  <col style={{ width: "230px" }} />
                </colgroup>
                <tbody>
                  {maestros.map((m, idx) => {
                    const esDiscurso = m.tipo === "discurso";
                    const titular = getNombre(m.titular_id);
                    const ayudante = getNombre(m.ayudante_id);
                    return (
                      <tr key={m.id}>
                        <td className="vym-hora">{maestroTimes[idx]}</td>
                        <td className="vym-titulo">
                          {numStartMaestros + idx}. {m.titulo || (esDiscurso ? "Discurso" : "Demostración")} ({defaultDurs[idx] ?? 4} {(defaultDurs[idx] ?? 4) === 1 ? "min." : "mins."})
                        </td>
                        <td className="vym-part">
                          {esDiscurso ? (
                            <span>{titular}</span>
                          ) : (
                            <span>{titular} <span className="vym-slash">/</span> {ayudante}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* NUESTRA VIDA CRISTIANA */}
          <div className="vym-section" style={{ background: COLOR_VIDA }}>
            <span className="vym-section-title">NUESTRA VIDA CRISTIANA</span>
          </div>
          <table className="vym-tabla">
            <colgroup>
              <col style={{ width: "44px" }} />
              <col />
              <col style={{ width: "230px" }} />
            </colgroup>
            <tbody>
              <tr>
                <td className="vym-hora">{tCancionInter}</td>
                <td className="vym-titulo">• Canción {programa.cantico_intermedio ?? "—"} (5 mins.)</td>
                <td></td>
              </tr>
              {vidaPartes.map((v, idx) => (
                <tr key={v.id}>
                  <td className="vym-hora">{vidaTimes[idx]}</td>
                  <td className="vym-titulo">
                    {numStartVida + idx}. {v.titulo || "Parte de la Vida Cristiana"} ({vidaDurs[idx] ?? 5} mins.)
                  </td>
                  <td className="vym-part">{getNombre(v.participante_id)}</td>
                </tr>
              ))}
              <tr>
                <td className="vym-hora">{tEstudio}</td>
                <td className="vym-titulo">
                  {numEstudio}. {programa.estudio_biblico?.visita_superintendente
                    ? programa.estudio_biblico?.titulo_discurso || "Discurso del superintendente"
                    : programa.estudio_biblico?.titulo || "Estudio bíblico de la congregación"} (30 mins.)
                </td>
                <td className="vym-part">
                  {programa.estudio_biblico?.visita_superintendente ? (
                    <span>{getNombre(programa.estudio_biblico?.conductor_id)}</span>
                  ) : (
                    <span>
                      {getNombre(programa.estudio_biblico?.conductor_id)} <span className="vym-slash">/</span>{" "}
                      {getNombre(programa.estudio_biblico?.lector_id)}
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="vym-hora">{tConclusion}</td>
                <td className="vym-titulo">• Palabras de conclusión (3 min.)</td>
                <td></td>
              </tr>
              <tr>
                <td className="vym-hora">{tCancionFinal}</td>
                <td className="vym-titulo">• Canción {programa.cantico_final ?? "—"} (5 mins.)</td>
                <td className="vym-part">
                  {programa.oracion_final_id && (
                    <><span className="vym-lbl">Oración:</span> {getNombre(programa.oracion_final_id)}</>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    };

    return (
      <div ref={ref} className="impresion-vym">
        <style>{`
          .impresion-vym {
            font-family: Arial, Helvetica, sans-serif;
            color: #1a1a1a;
            background: white;
            font-size: 10.5px;
            line-height: 1.35;
          }
          @media print {
            @page { size: letter portrait; margin: 10mm 12mm; }
          }
          .vym-page {
            page-break-after: always;
          }
          .vym-page:last-child { page-break-after: auto; }

          .vym-page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1a1a1a;
            padding-bottom: 4px;
            margin-bottom: 10px;
          }
          .vym-page-header .vym-cong {
            font-weight: bold;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          .vym-page-header .vym-titulo-page {
            font-weight: bold;
            font-size: 14px;
          }

          .vym-semana {
            margin-bottom: 14px;
            border-bottom: 1px solid #d4d4d4;
            padding-bottom: 10px;
          }
          .vym-semana:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }

          .vym-header { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
          .vym-header td { vertical-align: top; padding: 2px 0; }
          .vym-fecha { font-weight: bold; font-size: 12px; }
          .vym-fecha-lectura { font-weight: bold; }
          .vym-presi { text-align: right; font-size: 10px; }
          .vym-presi .vym-lbl { color: #666; font-weight: bold; margin-right: 4px; }
          .vym-presi .vym-val { font-weight: normal; }

          .vym-section {
            color: white;
            font-weight: bold;
            font-size: 11px;
            letter-spacing: 0.4px;
            padding: 4px 8px;
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .vym-section-title { }
          .vym-section-aux { font-weight: normal; font-size: 10px; }

          .vym-tabla { width: 100%; border-collapse: collapse; }
          .vym-tabla td {
            padding: 2px 6px;
            vertical-align: top;
            font-size: 10.5px;
          }
          .vym-hora { color: #666; font-weight: normal; white-space: nowrap; }
          .vym-titulo { }
          .vym-part { text-align: right; font-weight: normal; }
          .vym-slash { color: #999; }
          .vym-lbl { color: #666; font-weight: bold; }
        `}</style>

        {chunks.map((chunk, pageIdx) => (
          <div key={pageIdx} className="vym-page">
            <div className="vym-page-header">
              <span className="vym-cong">{(congregacionNombre || "").toUpperCase()}</span>
              <span className="vym-titulo-page">Programa para la reunión de entre semana</span>
            </div>
            {chunk.map(renderSemana)}
          </div>
        ))}
      </div>
    );
  }
);

ImpresionVidaMinisterio.displayName = "ImpresionVidaMinisterio";
