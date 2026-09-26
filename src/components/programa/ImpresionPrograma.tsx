import { forwardRef } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio, etiquetaPuntoPorModalidad, esIndividualSinDetalle, CAPITAN_POR_GRUPO, ETIQUETA_INDIVIDUAL_SIN_DETALLE } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { TerritorioLinkPrint } from "./TerritorioLink";
import { ColorTheme, getColorTheme } from "@/lib/congregation-colors";
import { generarFilasPrograma, type EntradaFormateada, type FilaPrograma } from "@/lib/programaPredicacionFilas";

interface DiaEspecial {
  id: string;
  nombre: string;
  bloqueo_tipo: string;
}

interface DiasReunionConfig {
  dia_entre_semana?: string;
  hora_entre_semana?: string;
  dia_fin_semana?: string;
  hora_fin_semana?: string;
}

interface MensajeAdicional {
  id: string;
  fecha: string;
  mensaje: string;
  color: string;
}

interface DireccionBloqueadaItem {
  id: string;
  territorio_id: string;
  direccion: string;
  motivo: string | null;
}

interface ImpresionProgramaProps {
  programa: ProgramaConDetalles[];
  horarios: HorarioSalida[];
  fechas: string[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  gruposPredicacion: GrupoPredicacion[];
  diasEspeciales?: DiaEspecial[];
  mensajesAdicionales?: MensajeAdicional[];
  diasReunionConfig?: DiasReunionConfig;
  direccionesBloqueadas?: DireccionBloqueadaItem[];
  mesAnio: string;
  colorTema?: string;
}

export const ImpresionPrograma = forwardRef<HTMLDivElement, ImpresionProgramaProps>(
  ({ programa, horarios, fechas, puntos, territorios, participantes, gruposPredicacion, diasEspeciales, mensajesAdicionales, diasReunionConfig, direccionesBloqueadas = [], mesAnio, colorTema = "blue" }, ref) => {
    
    // Obtener colores del tema para el PDF
    const theme = getColorTheme(colorTema);
    const pdfColors = theme.pdf;
    
    // Los datos (filas del programa) se calculan en un módulo aparte, compartido con el PDF dibujado.
    const filas = generarFilasPrograma({ programa, horarios, fechas, puntos, territorios, participantes, gruposPredicacion, mensajesAdicionales, diasReunionConfig });

    // Ajuste dinámico de padding vertical para filas de datos según cantidad de líneas
    const totalFilas = filas.length;
    const cellPaddingY = totalFilas > 50 ? 1 : totalFilas > 40 ? 2 : 3;
    const cellPaddingYScreen = totalFilas > 50 ? 4 : totalFilas > 40 ? 6 : 8;

    // Helper: render captain name with line break between nombre and apellido (print only)
    const renderCapitanPrint = (capitan: string) => {
      if (!capitan) return null;
      const parts = capitan.split(" ");
      if (parts.length <= 1) return capitan;
      // First word = nombre, rest = apellido
      const nombre = parts[0];
      const apellido = parts.slice(1).join(" ");
      return (
        <span className="capitan-nombre-print">
          {nombre} <span className="capitan-apellido">{apellido}</span>
        </span>
      );
    };

    // Render celdas mañana: HORA | GRUPOS | PUNTO ENCUENTRO | TERR. | CAPITÁN
    const renderCeldasManana = (
      entrada: EntradaFormateada | null,
      mensaje: string | null,
      // rowSpan cuando hay menos salidas de mañana que filas del día: así la
      // salida queda centrada verticalmente en vez de pegada arriba.
      mananaRowSpan?: number,
      renderizarCeldaManana: boolean = true,
    ) => {
      if (mensaje) {
        return (
          <td colSpan={5} className="print-cell print-cell-mensaje print-cell-separator">
            {mensaje}
          </td>
        );
      }

      // Ya cubierto por el rowSpan de una fila anterior.
      if (!renderizarCeldaManana) return null;

      const efectivoRowSpan = mananaRowSpan && mananaRowSpan > 1 ? mananaRowSpan : undefined;
      const estiloCentrado = efectivoRowSpan ? { verticalAlign: "middle" as const } : undefined;

      if (!entrada) {
        return (
          <>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}></td>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}></td>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}></td>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}></td>
            <td className="print-cell print-cell-separator" rowSpan={efectivoRowSpan} style={estiloCentrado}></td>
          </>
        );
      }

      // Salidas por grupos individuales (domingos) - "Predicación por grupo de servicio"
      if (entrada.esPorGrupoIndividual) {
        // Dividir: máximo 6 grupos en línea 1, el resto en línea 2
        const totalGrupos = entrada.gruposLineas.length;
        const linea1 = entrada.gruposLineas.slice(0, Math.min(6, totalGrupos));
        const linea2 = totalGrupos > 6 ? entrada.gruposLineas.slice(6) : [];
        
        return (
          <>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}>{entrada.hora}</td>
            <td colSpan={3} className="print-cell print-cell-grupos-inline" rowSpan={efectivoRowSpan} style={estiloCentrado}>
              {/* Línea 1: máximo 6 grupos */}
              <div className="grupos-linea">
                {linea1.map((linea, idx) => (
                  <span key={idx} className="grupo-item">
                    {idx > 0 && <span className="grupo-separator"> / </span>}
                    <span className="grupo-label">{linea.grupos}:</span>{" "}
                    {linea.territorioId ? (
                      <TerritorioLinkPrint territorioIds={[linea.territorioId]} territorios={territorios} />
                    ) : (
                      <span>{linea.territorioNum}</span>
                    )}
                  </span>
                ))}
              </div>
              {/* Línea 2: grupos restantes (si hay más de 6) */}
              {linea2.length > 0 && (
                <div className="grupos-linea">
                  {linea2.map((linea, idx) => (
                    <span key={idx} className="grupo-item">
                      {idx > 0 && <span className="grupo-separator"> / </span>}
                      <span className="grupo-label">{linea.grupos}:</span>{" "}
                      {linea.territorioId ? (
                        <TerritorioLinkPrint territorioIds={[linea.territorioId]} territorios={territorios} />
                      ) : (
                        <span>{linea.territorioNum}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </td>
            <td className="print-cell print-cell-separator print-cell-wrap print-cell-capitan" rowSpan={efectivoRowSpan} style={estiloCentrado}>{renderCapitanPrint(entrada.capitan)}</td>
          </>
        );
      }

      // Predicación por Zoom
      if (entrada.esZoom) {
        return (
          <>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}>{entrada.hora}</td>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}>{entrada.grupos}</td>
            <td className="print-cell print-cell-punto print-cell-wrap" rowSpan={efectivoRowSpan} style={estiloCentrado}>
              <div className="punto-nombre">{entrada.puntoEncuentro || "ZOOM"}</div>
              {entrada.urlMaps ? (
                <a href={entrada.urlMaps} target="_blank" rel="noopener noreferrer" className="punto-direccion">
                  {entrada.direccion || "ENLACE"}
                </a>
              ) : (
                <div className="punto-direccion">{entrada.direccion || "CARTAS"}</div>
              )}
            </td>
            <td className="print-cell print-cell-terr-wrap" rowSpan={efectivoRowSpan} style={estiloCentrado}>
              {entrada.territorioIds?.length ? (
                <TerritorioLinkPrint territorioIds={entrada.territorioIds} territorios={territorios} />
              ) : (
                entrada.territorioNumero
              )}
            </td>
            <td className="print-cell print-cell-separator print-cell-wrap print-cell-capitan" rowSpan={efectivoRowSpan} style={estiloCentrado}>{renderCapitanPrint(entrada.capitan)}</td>
          </>
        );
      }

      return (
        <>
          <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}>{entrada.hora}</td>
          <td className="print-cell" rowSpan={efectivoRowSpan} style={estiloCentrado}>{entrada.grupos}</td>
          <td className="print-cell print-cell-punto print-cell-wrap" rowSpan={efectivoRowSpan} style={estiloCentrado}>
            <div className="punto-nombre">{entrada.puntoEncuentro}</div>
            {(entrada.direccion || entrada.urlMaps) && (
              entrada.urlMaps ? (
                <a href={entrada.urlMaps} target="_blank" rel="noopener noreferrer" className="punto-direccion">
                  {entrada.direccion || "VER MAPA"}
                </a>
              ) : (
                <div className="punto-direccion">{entrada.direccion}</div>
              )
            )}
          </td>
           <td className="print-cell print-cell-terr-wrap" rowSpan={efectivoRowSpan} style={estiloCentrado}>
             {entrada.territorioIds?.length ? (
               <TerritorioLinkPrint territorioIds={entrada.territorioIds} territorios={territorios} />
             ) : (
               entrada.territorioNumero
             )}
           </td>
          <td className="print-cell print-cell-separator print-cell-wrap print-cell-capitan" rowSpan={efectivoRowSpan} style={estiloCentrado}>{renderCapitanPrint(entrada.capitan)}</td>
        </>
      );
    };

    // Render celdas tarde: HORA | DIRECCIÓN | TERR. | CAPITÁN
    // Ahora acepta parámetros adicionales para manejar el centrado vertical con rowSpan
    const renderCeldasTarde = (
      entrada: EntradaFormateada | null, 
      mensaje: string | null, 
      rowSpanMensaje?: number, 
      esPrimeraFilaDelDia?: boolean,
      tardeRowSpan?: number,  // rowSpan para cuando hay desbalance AM/PM
      renderizarCeldaTarde?: boolean  // Si false, no renderizar (está cubierto por rowSpan)
    ) => {
      // Si hay mensaje y es la primera fila del día, renderizar con rowSpan
      if (mensaje && esPrimeraFilaDelDia && rowSpanMensaje && rowSpanMensaje > 1) {
        return (
          <td colSpan={4} rowSpan={rowSpanMensaje} className="print-cell print-cell-mensaje print-cell-last" style={{ verticalAlign: 'middle' }}>
            {mensaje}
          </td>
        );
      }
      
      // Si hay mensaje pero NO es la primera fila del día, no renderizar nada (el rowSpan lo cubre)
      if (mensaje && !esPrimeraFilaDelDia) {
        return null;
      }
      
      // Si hay mensaje y es la primera fila pero sin rowSpan (1 sola fila)
      if (mensaje) {
        return (
          <td colSpan={4} className="print-cell print-cell-mensaje print-cell-last">
            {mensaje}
          </td>
        );
      }

      // Si renderizarCeldaTarde es explícitamente false, no renderizar (está cubierto por rowSpan)
      if (renderizarCeldaTarde === false) {
        return null;
      }

      // Calcular rowSpan efectivo
      const efectivoRowSpan = tardeRowSpan && tardeRowSpan > 1 ? tardeRowSpan : undefined;

      if (!entrada) {
        // Celdas vacías - con rowSpan si hay desbalance
        if (efectivoRowSpan) {
          return (
            <>
              <td className="print-cell" rowSpan={efectivoRowSpan} style={{ verticalAlign: 'middle' }}></td>
              <td className="print-cell" rowSpan={efectivoRowSpan} style={{ verticalAlign: 'middle' }}></td>
              <td className="print-cell" rowSpan={efectivoRowSpan} style={{ verticalAlign: 'middle' }}></td>
              <td className="print-cell print-cell-last" rowSpan={efectivoRowSpan} style={{ verticalAlign: 'middle' }}></td>
            </>
          );
        }
        return (
          <>
            <td className="print-cell"></td>
            <td className="print-cell"></td>
            <td className="print-cell"></td>
            <td className="print-cell print-cell-last"></td>
          </>
        );
      }

      // Predicación por Zoom (con o sin rowSpan)
      if (entrada.esZoom) {
        return (
          <>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>{entrada.hora}</td>
            <td className="print-cell print-cell-punto print-cell-wrap" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>
              <div className="punto-nombre">{entrada.puntoEncuentro || "ZOOM"}</div>
              {entrada.urlMaps ? (
                <a href={entrada.urlMaps} target="_blank" rel="noopener noreferrer" className="punto-direccion">
                  {entrada.direccion || "ENLACE"}
                </a>
              ) : (
                <div className="punto-direccion">{entrada.direccion || "CARTAS"}</div>
              )}
            </td>
            <td className="print-cell print-cell-terr-wrap" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>
              {entrada.territorioIds?.length ? (
                <TerritorioLinkPrint territorioIds={entrada.territorioIds} territorios={territorios} />
              ) : (
                entrada.territorioNumero
              )}
            </td>
            <td className="print-cell print-cell-last print-cell-wrap print-cell-capitan" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>{renderCapitanPrint(entrada.capitan)}</td>
          </>
        );
      }

      // Entrada normal (con o sin rowSpan)
      return (
        <>
          <td className="print-cell" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>{entrada.hora}</td>
          <td className="print-cell print-cell-punto print-cell-wrap" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>
            <div className="punto-nombre">{entrada.puntoEncuentro}</div>
            {(entrada.direccion || entrada.urlMaps) && (
              entrada.urlMaps ? (
                <a href={entrada.urlMaps} target="_blank" rel="noopener noreferrer" className="punto-direccion">
                  {entrada.direccion || "VER MAPA"}
                </a>
              ) : (
                <div className="punto-direccion">{entrada.direccion}</div>
              )
            )}
          </td>
          <td className="print-cell print-cell-terr-wrap" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>
            {entrada.territorioIds?.length ? (
              <TerritorioLinkPrint territorioIds={entrada.territorioIds} territorios={territorios} />
            ) : (
              entrada.territorioNumero
            )}
          </td>
          <td className="print-cell print-cell-last print-cell-wrap print-cell-capitan" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>{renderCapitanPrint(entrada.capitan)}</td>
        </>
      );
    };

    return (
      <div ref={ref} className="print-container">
        <style>{`
          @page {
            size: letter portrait;
            margin: 3mm 5mm;
          }
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              height: 100%;
              margin: 0;
              padding: 0;
              background: white !important;
            }
            .print-container {
              background: white !important;
              padding: 2mm 3mm !important;
              box-sizing: border-box !important;
            }
          }
          
          .print-container {
            font-family: 'Calibri', Arial, sans-serif;
            font-size: 9pt;
            line-height: 1.1;
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            padding: 12px;
            background: white;
            color: black;
            box-sizing: border-box;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          @media print {
            .print-container {
              font-size: 5.5pt;
              line-height: 1.0;
              width: 200mm;
              max-width: 200mm;
              padding: 2mm 3mm;
              overflow: visible;
            }
          }
          
          .print-table {
            width: max-content;
            min-width: 100%;
            border-collapse: collapse;
            table-layout: auto;
            border: 1pt solid ${pdfColors.headerDark};
          }
          
          @media print {
            .print-table {
              width: 100%;
              table-layout: fixed;
            }
            /* Column widths for print - optimized for letter size */
            /* Suman 100 %: mañana 7+5+7+22+6+10 y tarde 5+22+6+10. El punto de encuentro
               (y la dirección de la tarde) llevan el mayor ancho porque son el texto más largo. */
            .col-fecha { width: 7%; }
            .col-hora { width: 5%; }
            .col-grupos { width: 7%; }
            .col-punto { width: 22%; }
            .col-terr { width: 6%; }
            .col-capitan { width: 10%; }
          }
          
          .print-title {
            font-family: 'Calibri Light', 'Calibri', Arial, sans-serif;
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 8px;
            padding-top: 8px;
            color: ${pdfColors.title};
          }
          
          @media print {
            .print-title {
              font-size: 9.5pt;
              margin-bottom: 3px;
              padding-top: 0;
            }
          }
          
          /* Header grupo (HORARIO MAÑANA / TARDE) */
          .print-header-group {
            font-family: 'Calibri', Arial, sans-serif;
            background: ${pdfColors.headerDark} !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 6px 2px;
            font-size: 10pt;
            border: none;
            text-transform: uppercase;
          }
          
          @media print {
            .print-header-group {
              padding: 2px 1px;
              font-size: 6.5pt;
            }
          }
          
          /* Header columnas */
          .print-header {
            font-family: 'Calibri', Arial, sans-serif;
            background: ${pdfColors.headerLight} !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 8px 2px;
            font-size: 9pt;
            border: none;
            text-transform: uppercase;
          }
          
          @media print {
            .print-header {
              padding: 3px 1px;
              font-size: 6.5pt;
            }
          }
          
          /* Celdas normales - SIN bordes interiores */
          .print-cell {
            padding: ${cellPaddingYScreen}px 6px;
            text-align: center;
            vertical-align: middle;
            font-size: 9pt;
            white-space: nowrap;
            border: none !important;
            border-top: none !important;
            border-bottom: none !important;
            border-left: none !important;
            border-right: none !important;
          }
          
          /* Permitir wrap en celdas específicas que pueden tener más contenido */
          .print-cell-wrap {
            white-space: normal;
            word-break: break-word;
            min-width: 80px;
          }
          
          @media print {
            .print-cell {
              padding: ${cellPaddingY}px 2px;
              font-size: 6.5pt;
              border: none !important;
              border-top: none !important;
              border-bottom: none !important;
              border-left: none !important;
              border-right: none !important;
            }
            /* Territory and captain cells should wrap in print */
            /* Pueden bajar de línea entre palabras, nunca partir una palabra por la mitad */
            .print-cell-terr-wrap {
              white-space: normal !important;
              word-break: normal;
              overflow-wrap: normal;
              hyphens: none;
            }
            .print-cell-capitan {
              white-space: normal !important;
              word-break: normal;
              overflow-wrap: normal;
              hyphens: none;
            }
          }
          
          /* Separador entre mañana y tarde - SOLO este borde vertical */
          .print-cell-separator {
            border-right: 1pt solid ${pdfColors.headerDark} !important;
          }
          
          .print-header-separator {
            border-right: 1pt solid ${pdfColors.headerDark} !important;
          }
          
          /* Borde derecho tabla */
          .print-cell-last {
            border-right: 1pt solid ${pdfColors.headerDark};
          }
          
          /* Celda fecha */
          .print-cell-fecha {
            font-family: 'Calibri', Arial, sans-serif;
            text-align: center;
            vertical-align: middle;
            font-size: 9pt;
            line-height: 1.2;
            padding: 8px 2px;
            border-left: 1pt solid ${pdfColors.headerDark};
            border-right: none;
          }
          
          .print-cell-fecha .dia-nombre {
            font-size: 8pt;
            font-weight: normal;
          }
          
          .print-cell-fecha .dia-numero {
            font-size: 9pt;
            font-weight: bold;
          }
          
          @media print {
            .print-cell-fecha {
              font-size: 6.5pt;
              line-height: 1.15;
              padding: 3px 1px;
            }
            .print-cell-fecha .dia-nombre {
              font-size: 6pt;
            }
            .print-cell-fecha .dia-numero {
              font-size: 6.5pt;
            }
          }
          
          /* Mensaje especial (reuniones, etc) */
          .print-cell-mensaje {
            background: #eaecee !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            font-size: 9pt;
            text-transform: uppercase;
            border: none;
          }
          
          @media print {
            .print-cell-mensaje {
              font-size: 6.5pt;
            }
          }
          
          /* Mensaje adicional (separadores como PREDICACIÓN EXTENDIDA) */
          .print-cell-mensaje-adicional {
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            font-size: 10pt;
            padding: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          @media print {
            .print-cell-mensaje-adicional {
              font-size: 6.5pt;
              padding: 2px;
            }
          }
          
          /* Punto de encuentro con dirección debajo */
          .print-cell-punto {
            text-align: center;
            vertical-align: middle;
            padding: 4px;
          }
          
          .print-cell-punto .punto-nombre {
            font-weight: normal;
            color: black;
            font-size: 9pt;
          }
          
          .print-cell-punto .punto-direccion {
            color: ${pdfColors.link};
            font-size: 8pt;
            font-weight: normal;
            text-decoration: none;
          }
          
          @media print {
            .print-cell-punto {
              padding: 2px;
            }
            .print-cell-punto .punto-nombre {
              font-size: 6.5pt;
            }
            .print-cell-punto .punto-direccion {
              font-size: 6pt;
            }
          }
          
          .print-cell-punto .punto-direccion:hover {
            text-decoration: underline;
          }
          
          /* Grupos inline (domingos) - horizontal con división en 2 líneas */
          .print-cell-grupos-inline {
            text-align: left;
            vertical-align: middle;
            font-size: 9pt;
            padding: 4px 8px;
            white-space: normal;
            line-height: 1.4;
          }
          
          .print-cell-grupos-inline .grupos-linea {
            display: block;
            text-align: center;
          }
          
          .print-cell-grupos-inline .grupo-item {
            display: inline;
            white-space: nowrap;
          }
          
          .print-cell-grupos-inline .grupo-separator {
            color: #666;
          }
          
          .print-cell-grupos-inline .grupo-label {
            font-weight: bold;
          }
          
          /* En móvil: mantener centrado */
          @media screen and (max-width: 768px) {
            .print-cell-grupos-inline {
              text-align: center;
            }
          }
          
          @media print {
            .print-cell-grupos-inline {
              font-size: 6.5pt;
              padding: 2px 2px;
              line-height: 1.2;
            }
            .print-cell-grupos-inline .grupos-linea {
              text-align: center;
            }
          }
          
          /* Links de territorio */
          .territorio-link {
            color: ${pdfColors.link};
            text-decoration: none;
            font-weight: bold;
          }
          
          .territorio-link:hover {
            color: ${pdfColors.headerDark};
          }
          
          /* Filas alternadas - solo para distinguir días */
          .print-row-alt {
            background: ${pdfColors.rowAlt} !important;
          }
          
          /* Fila adicional (múltiples salidas mismo día) - SIN alternar color */
          .print-row-adicional {
            /* Hereda el color de la fila principal del día */
          }
          
          /* Sin bordes entre filas - solo zebra distingue días */
          .print-row-last-of-day td {
            /* Sin borde inferior */
          }
        `}</style>
        
        <div className="print-title">
          PROGRAMA DE PREDICACIÓN - {mesAnio.toUpperCase()}
        </div>
        
        <table className="print-table">
          <colgroup>
            <col className="col-fecha" /> {/* FECHA */}
            {/* MAÑANA: 5 columnas */}
            <col className="col-hora" /> {/* HORA */}
            <col className="col-grupos" /> {/* GRUPOS */}
            <col className="col-punto" /> {/* PUNTO ENCUENTRO */}
            <col className="col-terr" /> {/* TERR */}
            <col className="col-capitan" /> {/* CAPITÁN */}
            {/* TARDE: 4 columnas */}
            <col className="col-hora" /> {/* HORA */}
            <col className="col-punto" /> {/* DIRECCIÓN */}
            <col className="col-terr" /> {/* TERR */}
            <col className="col-capitan" /> {/* CAPITÁN */}
          </colgroup>
          <thead>
            <tr>
              <th className="print-header-group" rowSpan={2}>FECHA</th>
              <th className="print-header-group print-header-separator" colSpan={5}>HORARIO MAÑANA</th>
              <th className="print-header-group print-cell-last" colSpan={4}>HORARIO TARDE</th>
            </tr>
            <tr>
              <th className="print-header">HORA</th>
              <th className="print-header">GRUPOS</th>
              <th className="print-header">PUNTO ENCUENTRO</th>
              <th className="print-header">TERR.</th>
              <th className="print-header print-header-separator">CAPITÁN</th>
              <th className="print-header">HORA</th>
              <th className="print-header">DIRECCIÓN</th>
              <th className="print-header">TERR.</th>
              <th className="print-header print-cell-last">CAPITÁN</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Agrupar filas por fecha para calcular rowSpan
              const filasPorFecha: Record<string, FilaPrograma[]> = {};
              filas.forEach(fila => {
                if (!filasPorFecha[fila.fecha]) {
                  filasPorFecha[fila.fecha] = [];
                }
                filasPorFecha[fila.fecha].push(fila);
              });
              
              return filas.map((fila, idx) => {
                // Calcular índice real para alternar colores (basado en fecha, no en fila)
                const fechaActual = fila.fecha;
                const idxFecha = fechas.indexOf(fechaActual);
                const esAlt = idxFecha % 2 === 1;
                
                // Contar filas del mismo día para rowSpan (solo filas de datos)
                const filasDelDia = filasPorFecha[fechaActual];
                const esPrimeraFilaDelDia = filasDelDia[0] === fila;
                const cantidadFilasDelDia = filasDelDia.length;
                
                // Calcular cuántas entradas de mañana y tarde hay para este día
                const entradasMananaDelDia = filasDelDia.filter(f => f.manana !== null).length;
                const entradasTardeDelDia = filasDelDia.filter(f => f.tarde !== null).length;
                
                // Calcular si hay desbalance AM/PM y necesitamos rowSpan para tarde
                const hayDesbalanceTarde = entradasTardeDelDia > 0 && entradasTardeDelDia < cantidadFilasDelDia;
                
                // Calcular rowSpan para cada entrada de tarde
                const tardeRowSpan = hayDesbalanceTarde 
                  ? Math.floor(cantidadFilasDelDia / entradasTardeDelDia) 
                  : 1;
                
                // Determinar si esta fila debe renderizar la celda de tarde (con rowSpan)
                // Encontrar el índice de esta fila dentro de las filas del día
                const filaIdxEnDia = filasDelDia.indexOf(fila);
                
                // Calcular los índices donde se deben renderizar las entradas de tarde
                const indicesTardeRender = new Set<number>();
                if (hayDesbalanceTarde) {
                  for (let t = 0; t < entradasTardeDelDia; t++) {
                    indicesTardeRender.add(t * tardeRowSpan);
                  }
                } else {
                  // Sin desbalance: cada fila renderiza su propia celda de tarde
                  for (let t = 0; t < cantidadFilasDelDia; t++) {
                    indicesTardeRender.add(t);
                  }
                }
                
                const renderizarCeldaTarde = indicesTardeRender.has(filaIdxEnDia);

                // Mismo criterio para la mañana: si hay menos salidas de mañana
                // que filas del día, cada una abarca varias filas y queda
                // centrada verticalmente (antes se dibujaba sólo en la primera
                // fila y el resto quedaban celdas vacías debajo).
                // Si el día tiene mensaje de mañana, ese mensaje ocupa las 5
                // columnas sólo en la primera fila y las demás siguen llevando
                // sus celdas: ahí no se agrupa, o quedarían filas sin celdas.
                const hayMensajeMananaDelDia = filasDelDia.some(f => f.mensajeManana);
                const hayDesbalanceManana = entradasMananaDelDia > 0
                  && entradasMananaDelDia < cantidadFilasDelDia
                  && !hayMensajeMananaDelDia;
                const mananaRowSpan = hayDesbalanceManana
                  ? Math.floor(cantidadFilasDelDia / entradasMananaDelDia)
                  : 1;

                const indicesMananaRender = new Set<number>();
                if (hayDesbalanceManana) {
                  for (let m = 0; m < entradasMananaDelDia; m++) {
                    indicesMananaRender.add(m * mananaRowSpan);
                  }
                } else {
                  for (let m = 0; m < cantidadFilasDelDia; m++) {
                    indicesMananaRender.add(m);
                  }
                }
                const renderizarCeldaManana = indicesMananaRender.has(filaIdxEnDia);

                let entradaMananaParaEstaFila = fila.manana;
                if (hayDesbalanceManana && renderizarCeldaManana) {
                  const entradasMananaArray = filasDelDia.filter(f => f.manana !== null).map(f => f.manana);
                  const mananaIdx = Math.floor(filaIdxEnDia / mananaRowSpan);
                  entradaMananaParaEstaFila = entradasMananaArray[mananaIdx] || null;
                }
                
                // Obtener la entrada de tarde correspondiente a esta posición
                // Si hay desbalance, necesitamos mapear el índice de la fila al índice de la entrada de tarde
                let entradaTardeParaEstaFila = fila.tarde;
                if (hayDesbalanceTarde && renderizarCeldaTarde) {
                  // Calcular qué entrada de tarde corresponde a este slot
                  const entradasTardeArray = filasDelDia.filter(f => f.tarde !== null).map(f => f.tarde);
                  const tardeIdx = Math.floor(filaIdxEnDia / tardeRowSpan);
                  entradaTardeParaEstaFila = entradasTardeArray[tardeIdx] || null;
                }
                
                return (
                  <>
                    {/* Fila de mensaje adicional si existe */}
                    {fila.mensajeAdicional && (
                      <tr key={`${fila.fecha}-msg-${idx}`}>
                        <td
                          colSpan={10}
                          className="print-cell print-cell-mensaje-adicional print-cell-last"
                          style={{ 
                            backgroundColor: fila.mensajeAdicional.color, 
                            color: "white",
                            borderLeft: "1.5pt solid #1a5276"
                          }}
                        >
                          {fila.mensajeAdicional.mensaje}
                        </td>
                      </tr>
                    )}
                    <tr 
                      key={`${fila.fecha}-${idx}`} 
                      className={`${esAlt ? "print-row-alt" : ""} ${fila.esFilaAdicional ? "print-row-adicional" : ""}`}
                    >
                      {/* Solo renderizar celda de fecha en la primera fila del día con rowSpan */}
                      {esPrimeraFilaDelDia && (
                        <td 
                          className="print-cell print-cell-fecha" 
                          rowSpan={cantidadFilasDelDia}
                        >
                          <div className="dia-nombre">{fila.diaSemana}</div>
                          <div className="dia-numero">{fila.diaNumero}</div>
                        </td>
                      )}
                      {fila.mensajeCompleto ? (
                        <td colSpan={9} className="print-cell print-cell-mensaje print-cell-last">
                          {fila.mensajeCompleto}
                        </td>
                      ) : (
                        <>
                          {renderCeldasManana(
                            entradaMananaParaEstaFila,
                            fila.mensajeManana,
                            hayDesbalanceManana ? mananaRowSpan : undefined,
                            renderizarCeldaManana,
                          )}
                          {(() => {
                            // Verificar si hay mensaje de tarde para este día
                            const mensajeTardeDelDia = filasDelDia.find(f => f.mensajeTarde)?.mensajeTarde || null;
                            return renderCeldasTarde(
                              entradaTardeParaEstaFila, 
                              mensajeTardeDelDia, 
                              cantidadFilasDelDia, 
                              esPrimeraFilaDelDia,
                              hayDesbalanceTarde ? tardeRowSpan : undefined,
                              renderizarCeldaTarde
                            );
                          })()}
                        </>
                      )}
                    </tr>
                  </>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    );
  }
);

ImpresionPrograma.displayName = "ImpresionPrograma";
