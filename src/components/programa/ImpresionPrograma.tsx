import { forwardRef } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { TerritorioLinkPrint } from "./TerritorioLink";
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
  territorioId: string;
  puntoEncuentro: string;
  direccion: string;
  urlMaps: string;
  esZoom: boolean;
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
  territorioIds: string[];
  capitan: string;
  esPorGrupos: boolean;
  esPorGrupoIndividual: boolean;
  gruposTexto: string;
  gruposLineas: AsignacionGrupoLinea[];
  esZoom: boolean;
  zoomUrl: string;
}

export const ImpresionPrograma = forwardRef<HTMLDivElement, ImpresionProgramaProps>(
  ({ programa, horarios, fechas, puntos, territorios, participantes, gruposPredicacion, diasEspeciales, mensajesAdicionales, diasReunionConfig, direccionesBloqueadas = [], mesAnio }, ref) => {
    
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
                territorioId: terr?.id || "",
                puntoEncuentro: "",
                direccion: "",
                urlMaps: "",
                esZoom: false,
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
            territorioIds: [],
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
        const porSalida: Record<number, { grupos: string[]; terrNum: string; terrImagenUrl: string; terrId: string; capitanNombre: string; puntoNombre: string; direccion: string; urlMaps: string; esZoom: boolean }> = {};
        
        asignaciones.forEach(a => {
          const idx = a.salida_index ?? 0;
          const grupo = gruposPredicacion.find(g => g.id === a.grupo_id);
          if (grupo) {
            if (!porSalida[idx]) {
              const puntoAsig = a.punto_encuentro_id ? puntos.find(p => p.id === a.punto_encuentro_id) : punto;
              const nombrePunto = puntoAsig?.nombre || punto?.nombre || "";
              porSalida[idx] = { 
                grupos: [], 
                terrNum: "", 
                terrImagenUrl: "",
                terrId: "",
                capitanNombre: "", 
                puntoNombre: nombrePunto,
                direccion: puntoAsig?.direccion || punto?.direccion || "",
                urlMaps: puntoAsig?.url_maps || punto?.url_maps || "",
                esZoom: nombrePunto.toLowerCase().includes("zoom")
              };
            }
            porSalida[idx].grupos.push(grupo.numero.toString());
            if (a.territorio_id) {
              const terr = territorios.find(t => t.id === a.territorio_id);
              porSalida[idx].terrNum = terr?.numero || "";
              porSalida[idx].terrImagenUrl = terr?.imagen_url || "";
              porSalida[idx].terrId = terr?.id || "";
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
              territorioId: salida.terrId,
              puntoEncuentro: salida.puntoNombre,
              direccion: salida.direccion,
              urlMaps: salida.urlMaps,
              esZoom: salida.esZoom,
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
          territorioIds: [],
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
        territorioIds: entrada.territorio_ids || (entrada.territorio_id ? [entrada.territorio_id] : []),
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
        ).sort((a, b) => {
          const horA = horarios.find(h => h.id === a.horario_id);
          const horB = horarios.find(h => h.id === b.horario_id);
          return (horA?.hora || "").localeCompare(horB?.hora || "");
        });
        
        const entradasTarde = programa.filter(
          p => p.fecha === fecha && p.horario_id && horarioTardeIds.includes(p.horario_id) && !p.es_mensaje_especial
        ).sort((a, b) => {
          const horA = horarios.find(h => h.id === a.horario_id);
          const horB = horarios.find(h => h.id === b.horario_id);
          return (horA?.hora || "").localeCompare(horB?.hora || "");
        });

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
          
          // Si es por grupo individual (domingos) - manejar múltiples salidas mañana/tarde
          if (entradaFormateada.esPorGrupoIndividual) {
            // Obtener todas las entradas formateadas de mañana y tarde
            const todasEntradasManana = entradasManana.map(e => formatearEntrada(e));
            const todasEntradasTarde = entradasTarde.map(e => formatearEntrada(e));
            
            const maxFilas = Math.max(todasEntradasManana.length, todasEntradasTarde.length, 1);
            
            for (let i = 0; i < maxFilas; i++) {
              todasFilas.push({
                fecha,
                diaSemana,
                diaNumero,
                esFilaAdicional: i > 0,
                manana: todasEntradasManana[i] || null,
                tarde: todasEntradasTarde[i] || null,
                mensajeCompleto: null,
                mensajeManana: i === 0 ? mensajeManana : null,
                mensajeTarde: i === 0 ? mensajeTarde : null,
                mensajeAdicional: i === 0 ? mensajeAdicional : null
              });
            }
          } else {
            // Múltiples salidas (sábados) - crear una fila por cada salida
            entradaFormateada.gruposLineas.forEach((linea, idx) => {
              const filaManana: EntradaFormateada = {
                hora: entradaFormateada.hora,
                grupos: linea.grupos,
                puntoEncuentro: linea.puntoEncuentro,
                direccion: linea.direccion,
                urlMaps: linea.urlMaps,
                territorioNumero: linea.territorioNum,
                territorioImagenUrl: linea.territorioImagenUrl,
                territorioIds: linea.territorioId ? [linea.territorioId] : [],
                capitan: linea.capitanNombre,
                esPorGrupos: false,
                esPorGrupoIndividual: false,
                gruposTexto: "",
                gruposLineas: [],
                esZoom: linea.esZoom,
                zoomUrl: ""
              };
              
              todasFilas.push({
                fecha,
                diaSemana,
                diaNumero,
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
          // Entrada normal - pero manejar múltiples salidas por horario
          const maxFilas = Math.max(entradasManana.length, entradasTarde.length, 1);
          
          for (let i = 0; i < maxFilas; i++) {
            todasFilas.push({
              fecha,
              diaSemana,
              diaNumero,
              esFilaAdicional: i > 0,
              manana: entradasManana[i] ? formatearEntrada(entradasManana[i]) : null,
              tarde: entradasTarde[i] ? formatearEntrada(entradasTarde[i]) : null,
              mensajeCompleto: null,
              mensajeManana: i === 0 ? mensajeManana : null,
              mensajeTarde: i === 0 ? mensajeTarde : null,
              mensajeAdicional: i === 0 ? mensajeAdicional : null
            });
          }
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
            <td className="print-cell"></td>
            <td className="print-cell"></td>
            <td className="print-cell"></td>
            <td className="print-cell"></td>
            <td className="print-cell print-cell-separator"></td>
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
            <td className="print-cell">{entrada.hora}</td>
            <td colSpan={3} className="print-cell print-cell-grupos-inline">
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
            <td className="print-cell print-cell-separator print-cell-wrap">{entrada.capitan}</td>
          </>
        );
      }

      // Predicación por Zoom
      if (entrada.esZoom) {
        return (
          <>
            <td className="print-cell">{entrada.hora}</td>
            <td className="print-cell">{entrada.grupos}</td>
            <td className="print-cell print-cell-punto print-cell-wrap">
              <div className="punto-nombre">PREDICACIÓN POR ZOOM</div>
              {entrada.urlMaps ? (
                <a href={entrada.urlMaps} target="_blank" rel="noopener noreferrer" className="punto-direccion">
                  {entrada.direccion || "ENLACE"}
                </a>
              ) : (
                <div className="punto-direccion">{entrada.direccion || "CARTAS"}</div>
              )}
            </td>
            <td className="print-cell">
              {entrada.territorioIds?.length ? (
                <TerritorioLinkPrint territorioIds={entrada.territorioIds} territorios={territorios} />
              ) : (
                entrada.territorioNumero
              )}
            </td>
            <td className="print-cell print-cell-separator print-cell-wrap">{entrada.capitan}</td>
          </>
        );
      }

      return (
        <>
          <td className="print-cell">{entrada.hora}</td>
          <td className="print-cell">{entrada.grupos}</td>
          <td className="print-cell print-cell-punto print-cell-wrap">
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
           <td className="print-cell">
             {entrada.territorioIds?.length ? (
               <TerritorioLinkPrint territorioIds={entrada.territorioIds} territorios={territorios} />
             ) : (
               entrada.territorioNumero
             )}
           </td>
          <td className="print-cell print-cell-separator print-cell-wrap">{entrada.capitan}</td>
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
              <td className="print-cell" rowSpan={efectivoRowSpan} style={{ verticalAlign: 'middle' }}>-</td>
              <td className="print-cell" rowSpan={efectivoRowSpan} style={{ verticalAlign: 'middle' }}>-</td>
              <td className="print-cell" rowSpan={efectivoRowSpan} style={{ verticalAlign: 'middle' }}>-</td>
              <td className="print-cell print-cell-last" rowSpan={efectivoRowSpan} style={{ verticalAlign: 'middle' }}>-</td>
            </>
          );
        }
        return (
          <>
            <td className="print-cell">-</td>
            <td className="print-cell">-</td>
            <td className="print-cell">-</td>
            <td className="print-cell print-cell-last">-</td>
          </>
        );
      }

      // Predicación por Zoom (con o sin rowSpan)
      if (entrada.esZoom) {
        return (
          <>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>{entrada.hora}</td>
            <td className="print-cell print-cell-punto print-cell-wrap" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>
              <div className="punto-nombre">PREDICACIÓN POR ZOOM</div>
              {entrada.urlMaps ? (
                <a href={entrada.urlMaps} target="_blank" rel="noopener noreferrer" className="punto-direccion">
                  {entrada.direccion || "ENLACE"}
                </a>
              ) : (
                <div className="punto-direccion">{entrada.direccion || "CARTAS"}</div>
              )}
            </td>
            <td className="print-cell" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>
              {entrada.territorioIds?.length ? (
                <TerritorioLinkPrint territorioIds={entrada.territorioIds} territorios={territorios} />
              ) : (
                entrada.territorioNumero
              )}
            </td>
            <td className="print-cell print-cell-last print-cell-wrap" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>{entrada.capitan}</td>
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
          <td className="print-cell" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>
            {entrada.territorioIds?.length ? (
              <TerritorioLinkPrint territorioIds={entrada.territorioIds} territorios={territorios} />
            ) : (
              entrada.territorioNumero
            )}
          </td>
          <td className="print-cell print-cell-last print-cell-wrap" rowSpan={efectivoRowSpan} style={efectivoRowSpan ? { verticalAlign: 'middle' } : undefined}>{entrada.capitan}</td>
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
            border: 1pt solid #1a5276;
          }
          
          @media print {
            .print-table {
              width: 100%;
              table-layout: fixed;
            }
            /* Column widths for print - optimized for letter size */
            .col-fecha { width: 6%; }
            .col-hora { width: 5%; }
            .col-grupos { width: 8%; }
            .col-punto { width: 18%; }
            .col-terr { width: 4%; }
            .col-capitan { width: 9%; }
          }
          
          .print-title {
            font-family: 'Calibri Light', 'Calibri', Arial, sans-serif;
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 8px;
            padding-top: 8px;
            color: #1a5276;
          }
          
          @media print {
            .print-title {
              font-size: 9pt;
              margin-bottom: 3px;
              padding-top: 0;
            }
          }
          
          /* Header grupo (HORARIO MAÑANA / TARDE) */
          .print-header-group {
            font-family: 'Calibri', Arial, sans-serif;
            background: #1a5276 !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 6px 2px;
            font-size: 10pt;
            border: 1pt solid #1a5276;
            text-transform: uppercase;
          }
          
          @media print {
            .print-header-group {
              padding: 2px 1px;
              font-size: 6pt;
            }
          }
          
          /* Header columnas */
          .print-header {
            font-family: 'Calibri', Arial, sans-serif;
            background: #2980b9 !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 8px 2px;
            font-size: 9pt;
            border: none;
            border-bottom: 1pt solid #1a5276;
            text-transform: uppercase;
          }
          
          @media print {
            .print-header {
              padding: 3px 1px;
              font-size: 6pt;
            }
          }
          
          /* Celdas normales - SIN bordes interiores */
          .print-cell {
            padding: 8px 6px;
            text-align: center;
            vertical-align: middle;
            font-size: 9pt;
            white-space: nowrap;
          }
          
          /* Permitir wrap en celdas específicas que pueden tener más contenido */
          .print-cell-wrap {
            white-space: normal;
            word-break: break-word;
            min-width: 80px;
          }
          
          @media print {
            .print-cell {
              padding: 3px 2px;
              font-size: 6pt;
            }
          }
          
          .print-cell-border-v {
            /* Sin borde vertical interior */
          }
          
          /* Separador entre mañana y tarde */
          .print-cell-separator {
            border-right: 1pt solid #1a5276 !important;
          }
          
          .print-header-separator {
            border-right: 1pt solid #1a5276 !important;
          }
          
          /* Borde derecho tabla */
          .print-cell-last {
            border-right: 1pt solid #1a5276;
          }
          
          /* Celda fecha */
          .print-cell-fecha {
            font-family: 'Calibri', Arial, sans-serif;
            text-align: center;
            vertical-align: middle;
            font-size: 9pt;
            line-height: 1.2;
            padding: 8px 2px;
            border-left: 1pt solid #1a5276;
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
              font-size: 6pt;
              line-height: 1.15;
              padding: 3px 1px;
            }
            .print-cell-fecha .dia-nombre {
              font-size: 5.5pt;
            }
            .print-cell-fecha .dia-numero {
              font-size: 6pt;
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
          }
          
          @media print {
            .print-cell-mensaje {
              font-size: 6pt;
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
              font-size: 6pt;
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
            color: #2980b9;
            font-size: 8pt;
            font-weight: normal;
            text-decoration: none;
          }
          
          @media print {
            .print-cell-punto {
              padding: 2px;
            }
            .print-cell-punto .punto-nombre {
              font-size: 6pt;
            }
            .print-cell-punto .punto-direccion {
              font-size: 5.5pt;
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
              font-size: 6pt;
              padding: 2px 2px;
              line-height: 1.2;
            }
            .print-cell-grupos-inline .grupos-linea {
              text-align: center;
            }
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
          
          /* Filas alternadas - solo para distinguir días */
          .print-row-alt {
            background: #d6eaf8 !important;
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
                          {renderCeldasManana(fila.manana, fila.mensajeManana)}
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
