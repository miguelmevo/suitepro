import { forwardRef } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";

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
  mesAnio: string;
}

interface FilaPrograma {
  fecha: string;
  diaSemana: string;
  diaNumero: string;
  esFilaAdicional: boolean;
  manana: EntradaFormateada | null;
  tarde: EntradaFormateada | null;
  mensajeCompleto: string | null;
  mensajeManana: string | null;
  mensajeTarde: string | null;
  mensajeAdicional?: { mensaje: string; color: string } | null;
}

interface AsignacionGrupoLinea {
  grupos: string;
  territorioNum: string;
  territorioImagenUrl: string;
  puntoEncuentro: string;
  direccion: string;
  capitanNombre: string;
}

interface EntradaFormateada {
  hora: string;
  grupos: string; // "GENERAL" o "1-2-3" o ""
  puntoEncuentro: string;
  direccion: string;
  urlMaps: string;
  territorioNumero: string;
  territorioImagenUrl: string;
  capitan: string;
  esPorGrupos: boolean;
  esPorGrupoIndividual: boolean;
  gruposTexto: string;
  gruposLineas: AsignacionGrupoLinea[];
  esZoom: boolean;
  zoomUrl: string;
}

export const ImpresionPrograma = forwardRef<HTMLDivElement, ImpresionProgramaProps>(
  ({ programa, horarios, fechas, puntos, territorios, participantes, gruposPredicacion, diasEspeciales, mensajesAdicionales, diasReunionConfig, mesAnio }, ref) => {
    
    // Clasificar horarios por nombre (contiene "mañana" o "tarde")
    const clasificarHorario = (horario: HorarioSalida): "manana" | "tarde" => {
      const nombreLower = horario.nombre.toLowerCase();
      if (nombreLower.includes("mañana") || nombreLower.includes("manana")) {
        return "manana";
      }
      if (nombreLower.includes("tarde")) {
        return "tarde";
      }
      // Fallback por hora si el nombre no es claro
      const hora = parseInt(horario.hora.split(":")[0], 10);
      return hora < 12 ? "manana" : "tarde";
    };

    const horariosManana = horarios.filter(h => clasificarHorario(h) === "manana");
    const horariosTarde = horarios.filter(h => clasificarHorario(h) === "tarde");

    const formatearEntrada = (entrada: ProgramaConDetalles, gruposLabel: string = "GENERAL"): EntradaFormateada => {
      const horario = horarios.find(h => h.id === entrada.horario_id);
      const punto = puntos.find(p => p.id === entrada.punto_encuentro_id);
      
      const direccion = punto?.direccion || "";
      const urlMaps = punto?.url_maps || "";
      
      // Detectar si es Zoom
      const esZoom = punto?.nombre?.toLowerCase().includes("zoom") || false;
      const zoomUrl = "https://jworg.zoom.us/j/89894597707?pwd=VmJibGlkZnp3RzZBSmxDNVJvRTRqUT09#success";
      
      // Manejar territorios múltiples
      let territorioNumero = "";
      let territorioImagenUrl = "";
      if (entrada.territorio_ids && entrada.territorio_ids.length > 0) {
        const terrs = entrada.territorio_ids
          .map(id => territorios.find(t => t.id === id))
          .filter((t): t is Territorio => t !== undefined)
          .sort((a, b) => {
            const numA = parseInt(a.numero, 10);
            const numB = parseInt(b.numero, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.numero.localeCompare(b.numero);
          });
        territorioNumero = terrs.map(t => t.numero).join(", ");
        if (terrs.length === 1 && terrs[0].imagen_url) {
          territorioImagenUrl = terrs[0].imagen_url;
        }
      } else if (entrada.territorio_id) {
        const terr = territorios.find(t => t.id === entrada.territorio_id);
        territorioNumero = terr?.numero || "";
        territorioImagenUrl = terr?.imagen_url || "";
      }

      const capitan = participantes.find(p => p.id === entrada.capitan_id);

      // Si es por grupos - crear líneas individuales
      if (entrada.es_por_grupos && entrada.asignaciones_grupos) {
        const asignaciones = entrada.asignaciones_grupos;
        
        // Detectar si es "por grupo individual" (domingos - todos con salida_index = 0 o undefined)
        const esPorGrupoIndividual = asignaciones.length > 0 && 
          asignaciones.every(a => a.salida_index === undefined || a.salida_index === 0);
        
        if (esPorGrupoIndividual) {
          // Formato: G1: 5 / G2: 6 / G3: 7...
          const gruposLineas = asignaciones
            .map(a => {
              const grupo = gruposPredicacion.find(g => g.id === a.grupo_id);
              const terr = a.territorio_id 
                ? territorios.find(t => t.id === a.territorio_id)
                : null;
              return {
                grupos: `G${grupo?.numero || "?"}`,
                territorioNum: terr?.numero || "",
                territorioImagenUrl: terr?.imagen_url || "",
                puntoEncuentro: "",
                direccion: "",
                capitanNombre: ""
              };
            })
            .sort((a, b) => {
              const numA = parseInt(a.grupos.replace("G", ""));
              const numB = parseInt(b.grupos.replace("G", ""));
              return numA - numB;
            });

          return {
            hora: horario?.hora.slice(0, 5) || "",
            grupos: "",
            puntoEncuentro: "",
            direccion: "",
            urlMaps: "",
            territorioNumero: "",
            territorioImagenUrl: "",
            capitan: "Superintendente de cada Grupo",
            esPorGrupos: true,
            esPorGrupoIndividual: true,
            gruposTexto: gruposLineas.map(l => `${l.grupos}: ${l.territorioNum}`).join(" / "),
            gruposLineas,
            esZoom: false,
            zoomUrl: ""
          };
        }
        
        // Modo "Por grupos de predicación" (sábados): agrupar por salida_index
        const gruposLineas: AsignacionGrupoLinea[] = [];
        const porSalida: Record<number, { grupos: string[]; terrNum: string; terrImagenUrl: string; capitanNombre: string; puntoNombre: string; direccion: string }> = {};
        
        asignaciones.forEach(a => {
          const idx = a.salida_index ?? 0;
          const grupo = gruposPredicacion.find(g => g.id === a.grupo_id);
          if (grupo) {
            if (!porSalida[idx]) {
              const puntoAsig = a.punto_encuentro_id ? puntos.find(p => p.id === a.punto_encuentro_id) : punto;
              porSalida[idx] = { 
                grupos: [], 
                terrNum: "", 
                terrImagenUrl: "", 
                capitanNombre: "", 
                puntoNombre: puntoAsig?.nombre || punto?.nombre || "",
                direccion: puntoAsig?.direccion || punto?.direccion || ""
              };
            }
            porSalida[idx].grupos.push(grupo.numero.toString());
            if (a.territorio_id) {
              const terr = territorios.find(t => t.id === a.territorio_id);
              porSalida[idx].terrNum = terr?.numero || "";
              porSalida[idx].terrImagenUrl = terr?.imagen_url || "";
            }
            if (a.capitan_id) {
              const cap = participantes.find(p => p.id === a.capitan_id);
              porSalida[idx].capitanNombre = cap ? `${cap.nombre} ${cap.apellido}` : "";
            }
          }
        });

        // Convertir a líneas ordenadas
        Object.entries(porSalida)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .forEach(([, salida]) => {
            const gruposOrdenados = salida.grupos
              .map(g => parseInt(g))
              .sort((a, b) => a - b)
              .join("-");
            gruposLineas.push({
              grupos: gruposOrdenados,
              territorioNum: salida.terrNum,
              territorioImagenUrl: salida.terrImagenUrl,
              puntoEncuentro: salida.puntoNombre,
              direccion: salida.direccion,
              capitanNombre: salida.capitanNombre
            });
          });

        return {
          hora: horario?.hora.slice(0, 5) || "",
          grupos: "",
          puntoEncuentro: punto?.nombre || "",
          direccion: "",
          urlMaps: "",
          territorioNumero: "",
          territorioImagenUrl: "",
          capitan: "",
          esPorGrupos: true,
          esPorGrupoIndividual: false,
          gruposTexto: "",
          gruposLineas,
          esZoom: false,
          zoomUrl: ""
        };
      }

      return {
        hora: horario?.hora.slice(0, 5) || "",
        grupos: gruposLabel,
        puntoEncuentro: punto?.nombre || "",
        direccion,
        urlMaps,
        territorioNumero,
        territorioImagenUrl,
        capitan: capitan ? `${capitan.nombre} ${capitan.apellido}` : "",
        esPorGrupos: false,
        esPorGrupoIndividual: false,
        gruposTexto: "",
        gruposLineas: [],
        esZoom,
        zoomUrl
      };
    };

    const getMensajeReunion = (fecha: string): { mensaje: string; tipo: "manana" | "tarde" | "completo" } | null => {
      if (!diasReunionConfig) return null;
      
      const date = parseISO(fecha);
      const diaSemana = format(date, "EEEE", { locale: es }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const normalizar = (dia: string) => dia?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
      
      const diaEntreSemana = normalizar(diasReunionConfig.dia_entre_semana || "");
      const diaFinSemana = normalizar(diasReunionConfig.dia_fin_semana || "");
      
      if (diaSemana === diaEntreSemana) {
        const hora = diasReunionConfig.hora_entre_semana || "19:30";
        return {
          mensaje: `REUNIÓN VIDA Y MINISTERIO CRISTIANO ${hora} HRAS.`,
          tipo: "tarde"
        };
      }
      
      if (diaSemana === diaFinSemana) {
        const hora = diasReunionConfig.hora_fin_semana || "18:00";
        return {
          mensaje: `REUNIÓN PÚBLICA ${hora} HRAS.`,
          tipo: "tarde"
        };
      }
      
      return null;
    };

    // Generar filas del programa - ahora puede generar múltiples filas por fecha
    const generarFilas = (): FilaPrograma[] => {
      const todasFilas: FilaPrograma[] = [];
      
      fechas.forEach(fecha => {
        const date = parseISO(fecha);
        const diaSemana = format(date, "EEEE", { locale: es }).toUpperCase();
        const diaNumero = format(date, "d");

        // Mensaje adicional
        const msgAdicional = mensajesAdicionales?.find(m => m.fecha === fecha);
        const mensajeAdicional = msgAdicional
          ? { mensaje: msgAdicional.mensaje, color: msgAdicional.color }
          : null;

        // Mensaje especial completo (todo el día)
        const mensajeEspecialCompleto = programa.find(
          p => p.fecha === fecha && p.es_mensaje_especial && p.colspan_completo
        );

        if (mensajeEspecialCompleto) {
          todasFilas.push({
            fecha,
            diaSemana,
            diaNumero,
            esFilaAdicional: false,
            manana: null,
            tarde: null,
            mensajeCompleto: mensajeEspecialCompleto.mensaje_especial,
            mensajeManana: null,
            mensajeTarde: null,
            mensajeAdicional
          });
          return;
        }

        // Buscar entradas de mañana y tarde
        const horarioMananaIds = horariosManana.map(h => h.id);
        const horarioTardeIds = horariosTarde.map(h => h.id);

        const entradasManana = programa.filter(
          p => p.fecha === fecha && p.horario_id && horarioMananaIds.includes(p.horario_id) && !p.es_mensaje_especial
        );
        const entradasTarde = programa.filter(
          p => p.fecha === fecha && p.horario_id && horarioTardeIds.includes(p.horario_id) && !p.es_mensaje_especial
        );

        // Mensajes especiales por horario
        const mensajeEspecialManana = programa.find(
          p => p.fecha === fecha && p.es_mensaje_especial && !p.colspan_completo && p.horario_id && horarioMananaIds.includes(p.horario_id)
        );
        const mensajeEspecialTarde = programa.find(
          p => p.fecha === fecha && p.es_mensaje_especial && !p.colspan_completo && p.horario_id && horarioTardeIds.includes(p.horario_id)
        );

        // Reuniones automáticas
        const reunion = getMensajeReunion(fecha);

        let mensajeManana: string | null = mensajeEspecialManana?.mensaje_especial || null;
        let mensajeTarde: string | null = mensajeEspecialTarde?.mensaje_especial || null;

        if (reunion) {
          if (reunion.tipo === "manana") {
            mensajeManana = reunion.mensaje;
          } else if (reunion.tipo === "tarde") {
            mensajeTarde = reunion.mensaje;
          }
        }

        // Verificar si hay entrada por grupos con múltiples salidas (sábados)
        const entradaMananaGrupos = entradasManana.find(e => e.es_por_grupos && e.asignaciones_grupos);
        
        if (entradaMananaGrupos) {
          const entradaFormateada = formatearEntrada(entradaMananaGrupos, "");
          
          // Si es por grupo individual (domingos) - una sola fila
          if (entradaFormateada.esPorGrupoIndividual) {
            todasFilas.push({
              fecha,
              diaSemana,
              diaNumero,
              esFilaAdicional: false,
              manana: entradaFormateada,
              tarde: entradasTarde.length > 0 ? formatearEntrada(entradasTarde[0]) : null,
              mensajeCompleto: null,
              mensajeManana,
              mensajeTarde,
              mensajeAdicional
            });
          } else {
            // Múltiples salidas (sábados) - crear una fila por cada salida
            entradaFormateada.gruposLineas.forEach((linea, idx) => {
              const filaManana: EntradaFormateada = {
                hora: entradaFormateada.hora,
                grupos: linea.grupos,
                puntoEncuentro: linea.puntoEncuentro,
                direccion: linea.direccion,
                urlMaps: "",
                territorioNumero: linea.territorioNum,
                territorioImagenUrl: linea.territorioImagenUrl,
                capitan: linea.capitanNombre,
                esPorGrupos: false,
                esPorGrupoIndividual: false,
                gruposTexto: "",
                gruposLineas: [],
                esZoom: false,
                zoomUrl: ""
              };
              
              todasFilas.push({
                fecha,
                diaSemana: idx === 0 ? diaSemana : "",
                diaNumero: idx === 0 ? diaNumero : "",
                esFilaAdicional: idx > 0,
                manana: filaManana,
                tarde: idx === 0 && entradasTarde.length > 0 ? formatearEntrada(entradasTarde[0]) : null,
                mensajeCompleto: null,
                mensajeManana: idx === 0 ? mensajeManana : null,
                mensajeTarde: idx === 0 ? mensajeTarde : null,
                mensajeAdicional: idx === 0 ? mensajeAdicional : null
              });
            });
          }
        } else {
          // Entrada normal
          todasFilas.push({
            fecha,
            diaSemana,
            diaNumero,
            esFilaAdicional: false,
            manana: entradasManana.length > 0 ? formatearEntrada(entradasManana[0]) : null,
            tarde: entradasTarde.length > 0 ? formatearEntrada(entradasTarde[0]) : null,
            mensajeCompleto: null,
            mensajeManana,
            mensajeTarde,
            mensajeAdicional
          });
        }
      });
      
      return todasFilas;
    };

    const filas = generarFilas();

    // Render celdas mañana: HORA | GRUPOS | PUNTO ENCUENTRO | TERR. | CAPITÁN
    const renderCeldasManana = (entrada: EntradaFormateada | null, mensaje: string | null) => {
      if (mensaje) {
        return (
          <td colSpan={5} className="print-cell print-cell-mensaje print-cell-separator">
            {mensaje}
          </td>
        );
      }

      if (!entrada) {
        return (
          <>
            <td className="print-cell print-cell-border-v"></td>
            <td className="print-cell print-cell-border-v"></td>
            <td className="print-cell print-cell-border-v"></td>
            <td className="print-cell print-cell-border-v"></td>
            <td className="print-cell print-cell-separator"></td>
          </>
        );
      }

      // Salidas por grupos individuales (domingos)
      if (entrada.esPorGrupoIndividual) {
        return (
          <>
            <td className="print-cell print-cell-border-v">{entrada.hora}</td>
            <td colSpan={3} className="print-cell print-cell-grupos-horizontal">
              {entrada.gruposLineas.map((linea, idx) => (
                <span key={idx}>
                  {idx > 0 && " / "}
                  <span className="grupo-label">{linea.grupos}:</span>{" "}
                  {linea.territorioImagenUrl ? (
                    <a href={linea.territorioImagenUrl} target="_blank" rel="noopener noreferrer" className="territorio-link">
                      {linea.territorioNum}
                    </a>
                  ) : (
                    <span>{linea.territorioNum}</span>
                  )}
                </span>
              ))}
            </td>
            <td className="print-cell print-cell-separator">{entrada.capitan}</td>
          </>
        );
      }

      // Predicación por Zoom
      if (entrada.esZoom) {
        return (
          <>
            <td className="print-cell print-cell-border-v">{entrada.hora}</td>
            <td className="print-cell print-cell-border-v">{entrada.grupos}</td>
            <td className="print-cell print-cell-punto">
              <div className="punto-nombre">PREDICACIÓN POR ZOOM</div>
              <div className="punto-direccion">CARTAS</div>
            </td>
            <td className="print-cell print-cell-border-v">
              {entrada.territorioImagenUrl ? (
                <a href={entrada.territorioImagenUrl} target="_blank" rel="noopener noreferrer" className="territorio-link">
                  {entrada.territorioNumero}
                </a>
              ) : (
                entrada.territorioNumero
              )}
            </td>
            <td className="print-cell print-cell-separator">{entrada.capitan}</td>
          </>
        );
      }

      return (
        <>
          <td className="print-cell print-cell-border-v">{entrada.hora}</td>
          <td className="print-cell print-cell-border-v">{entrada.grupos}</td>
          <td className="print-cell print-cell-punto">
            <div className="punto-nombre">{entrada.puntoEncuentro}</div>
            {entrada.direccion && <div className="punto-direccion">{entrada.direccion}</div>}
          </td>
          <td className="print-cell print-cell-border-v">
            {entrada.territorioImagenUrl ? (
              <a href={entrada.territorioImagenUrl} target="_blank" rel="noopener noreferrer" className="territorio-link">
                {entrada.territorioNumero}
              </a>
            ) : (
              entrada.territorioNumero
            )}
          </td>
          <td className="print-cell print-cell-separator">{entrada.capitan}</td>
        </>
      );
    };

    // Render celdas tarde: HORA | DIRECCIÓN | TERR. | CAPITÁN
    const renderCeldasTarde = (entrada: EntradaFormateada | null, mensaje: string | null) => {
      if (mensaje) {
        return (
          <td colSpan={4} className="print-cell print-cell-mensaje print-cell-last">
            {mensaje}
          </td>
        );
      }

      if (!entrada) {
        return (
          <>
            <td className="print-cell print-cell-border-v"></td>
            <td className="print-cell print-cell-border-v"></td>
            <td className="print-cell print-cell-border-v"></td>
            <td className="print-cell print-cell-last"></td>
          </>
        );
      }

      // Predicación por Zoom
      if (entrada.esZoom) {
        return (
          <>
            <td className="print-cell print-cell-border-v">{entrada.hora}</td>
            <td className="print-cell print-cell-punto">
              <div className="punto-nombre">PREDICACIÓN POR ZOOM</div>
              <div className="punto-direccion">CARTAS</div>
            </td>
            <td className="print-cell print-cell-border-v">
              {entrada.territorioImagenUrl ? (
                <a href={entrada.territorioImagenUrl} target="_blank" rel="noopener noreferrer" className="territorio-link">
                  {entrada.territorioNumero}
                </a>
              ) : (
                entrada.territorioNumero
              )}
            </td>
            <td className="print-cell print-cell-last">{entrada.capitan}</td>
          </>
        );
      }

      return (
        <>
          <td className="print-cell print-cell-border-v">{entrada.hora}</td>
          <td className="print-cell print-cell-punto">
            <div className="punto-nombre">{entrada.puntoEncuentro}</div>
            {entrada.direccion && <div className="punto-direccion">{entrada.direccion}</div>}
          </td>
          <td className="print-cell print-cell-border-v">
            {entrada.territorioImagenUrl ? (
              <a href={entrada.territorioImagenUrl} target="_blank" rel="noopener noreferrer" className="territorio-link">
                {entrada.territorioNumero}
              </a>
            ) : (
              entrada.territorioNumero
            )}
          </td>
          <td className="print-cell print-cell-last">{entrada.capitan}</td>
        </>
      );
    };

    return (
      <div ref={ref} className="print-container">
        <style>{`
          @page {
            size: letter portrait;
            margin: 0.2in 0.15in;
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
            }
          }
          
          .print-container {
            font-family: 'Calibri', Arial, sans-serif;
            font-size: 7pt;
            line-height: 1.15;
            width: 100%;
            max-width: 8.2in;
            margin: 0 auto;
            background: white;
            color: black;
          }
          
          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            border: 1.5pt solid #1a5276;
          }
          
          .print-title {
            font-family: 'Calibri Light', 'Calibri', Arial, sans-serif;
            text-align: center;
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 6px;
            color: #1a5276;
          }
          
          /* Header grupo (HORARIO MAÑANA / TARDE) */
          .print-header-group {
            font-family: 'Calibri', Arial, sans-serif;
            background: #1a5276 !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 4px 2px;
            font-size: 7pt;
            border: 1pt solid #1a5276;
            text-transform: uppercase;
          }
          
          /* Header columnas */
          .print-header {
            font-family: 'Calibri', Arial, sans-serif;
            background: #2980b9 !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 3px 2px;
            font-size: 6pt;
            border: 0.5pt solid #1a5276;
            text-transform: uppercase;
          }
          
          /* Celdas normales */
          .print-cell {
            padding: 4px 3px;
            text-align: center;
            vertical-align: middle;
            font-size: 7pt;
            overflow: hidden;
            text-overflow: ellipsis;
            border-bottom: 0.5pt solid #bdc3c7;
          }
          
          .print-cell-border-v {
            border-left: 0.5pt solid #d5dbdb;
          }
          
          /* Separador entre mañana y tarde */
          .print-cell-separator {
            border-right: 1.5pt solid #1a5276 !important;
          }
          
          .print-header-separator {
            border-right: 1.5pt solid #1a5276 !important;
          }
          
          /* Borde derecho tabla */
          .print-cell-last {
            border-right: 1.5pt solid #1a5276;
          }
          
          /* Celda fecha */
          .print-cell-fecha {
            font-family: 'Calibri', Arial, sans-serif;
            text-align: center;
            vertical-align: middle;
            font-size: 6.5pt;
            line-height: 1.1;
            padding: 3px 2px;
            border-left: 1.5pt solid #1a5276;
            border-right: 0.5pt solid #d5dbdb;
            border-bottom: 0.5pt solid #bdc3c7;
          }
          
          .print-cell-fecha .dia-nombre {
            font-size: 5.5pt;
            font-weight: normal;
          }
          
          .print-cell-fecha .dia-numero {
            font-size: 6pt;
            font-weight: bold;
          }
          
          /* Mensaje especial (reuniones, etc) */
          .print-cell-mensaje {
            background: #eaecee !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            font-size: 6.5pt;
            text-transform: uppercase;
            border-bottom: 0.5pt solid #bdc3c7;
          }
          
          /* Mensaje adicional (separadores como PREDICACIÓN EXTENDIDA) */
          .print-cell-mensaje-adicional {
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            font-size: 7pt;
            padding: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 0.5pt solid #bdc3c7;
          }
          
          /* Punto de encuentro con dirección debajo */
          .print-cell-punto {
            text-align: center;
            vertical-align: middle;
            padding: 3px 4px;
            border-left: 0.5pt solid #d5dbdb;
          }
          
          .print-cell-punto .punto-nombre {
            font-weight: normal;
            color: black;
            font-size: 6.5pt;
          }
          
          .print-cell-punto .punto-direccion {
            color: #2980b9;
            font-size: 6pt;
            font-weight: normal;
          }
          
          /* Grupos horizontal (domingos) */
          .print-cell-grupos-horizontal {
            text-align: left;
            vertical-align: middle;
            font-size: 6.5pt;
            padding: 3px 4px;
            border-left: 0.5pt solid #d5dbdb;
          }
          
          .print-cell-grupos-horizontal .grupo-label {
            font-weight: bold;
          }
          
          /* Links de territorio */
          .territorio-link {
            color: #2980b9;
            text-decoration: none;
            font-weight: bold;
          }
          
          .territorio-link:hover {
            color: #1a5276;
          }
          
          /* Filas alternadas */
          .print-row-alt {
            background: #d6eaf8 !important;
          }
          
          /* Fila adicional (sin fecha) */
          .print-row-adicional .print-cell-fecha {
            border-bottom: none;
          }
        `}</style>
        
        <div className="print-title">
          PROGRAMA DE PREDICACIÓN - {mesAnio.toUpperCase()}
        </div>
        
        <table className="print-table">
          <colgroup>
            <col style={{ width: "6%" }} /> {/* FECHA */}
            {/* MAÑANA: 5 columnas */}
            <col style={{ width: "5%" }} /> {/* HORA */}
            <col style={{ width: "7%" }} /> {/* GRUPOS */}
            <col style={{ width: "15%" }} /> {/* PUNTO ENCUENTRO */}
            <col style={{ width: "4%" }} /> {/* TERR */}
            <col style={{ width: "11%" }} /> {/* CAPITÁN */}
            {/* TARDE: 4 columnas */}
            <col style={{ width: "5%" }} /> {/* HORA */}
            <col style={{ width: "15%" }} /> {/* DIRECCIÓN */}
            <col style={{ width: "4%" }} /> {/* TERR */}
            <col style={{ width: "11%" }} /> {/* CAPITÁN */}
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
            {filas.map((fila, idx) => {
              // Calcular índice real para alternar colores (sin contar filas adicionales)
              const idxReal = filas.slice(0, idx).filter(f => !f.esFilaAdicional).length;
              const esAlt = idxReal % 2 === 1;
              
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
                    <td className="print-cell print-cell-fecha">
                      {!fila.esFilaAdicional && (
                        <>
                          <div className="dia-nombre">{fila.diaSemana}</div>
                          <div className="dia-numero">{fila.diaNumero}</div>
                        </>
                      )}
                    </td>
                    {fila.mensajeCompleto ? (
                      <td colSpan={9} className="print-cell print-cell-mensaje print-cell-last">
                        {fila.mensajeCompleto}
                      </td>
                    ) : (
                      <>
                        {renderCeldasManana(fila.manana, fila.mensajeManana)}
                        {renderCeldasTarde(fila.tarde, fila.mensajeTarde)}
                      </>
                    )}
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);

ImpresionPrograma.displayName = "ImpresionPrograma";
