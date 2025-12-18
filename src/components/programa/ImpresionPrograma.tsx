import { forwardRef } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";

interface DiaEspecial {
  id: string;
  nombre: string;
  fecha: string;
  bloqueo_tipo: string;
}

interface DiasReunionConfig {
  dia_entre_semana?: string;
  hora_entre_semana?: string;
  dia_fin_semana?: string;
  hora_fin_semana?: string;
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
  diasReunionConfig?: DiasReunionConfig;
  mesAnio: string;
}

interface FilaDia {
  fecha: string;
  diaSemana: string;
  diaNumero: string;
  manana: EntradaFormateada | null;
  tarde: EntradaFormateada | null;
  mensajeCompleto: string | null;
  mensajeManana: string | null;
  mensajeTarde: string | null;
}

interface AsignacionGrupoLinea {
  grupo: string;
  territorioNum: string;
  puntoEncuentro: string;
  capitanNombre: string;
}

interface EntradaFormateada {
  hora: string;
  puntoEncuentro: string;
  direccion: string;
  urlMaps: string;
  territorioNumero: string;
  capitan: string;
  esPorGrupos: boolean;
  gruposTexto: string;
  gruposLineas: AsignacionGrupoLinea[];
  esZoom: boolean;
  zoomUrl: string;
}

export const ImpresionPrograma = forwardRef<HTMLDivElement, ImpresionProgramaProps>(
  ({ programa, horarios, fechas, puntos, territorios, participantes, gruposPredicacion, diasEspeciales, diasReunionConfig, mesAnio }, ref) => {
    
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

    const formatearEntrada = (entrada: ProgramaConDetalles): EntradaFormateada => {
      const horario = horarios.find(h => h.id === entrada.horario_id);
      const punto = puntos.find(p => p.id === entrada.punto_encuentro_id);
      
      // Obtener descripción/dirección del punto de encuentro
      const direccion = punto?.direccion || "";
      const urlMaps = punto?.url_maps || "";
      
      // Detectar si es Zoom
      const esZoom = punto?.nombre?.toLowerCase().includes("zoom") || false;
      const zoomUrl = "https://jworg.zoom.us/j/89894597707?pwd=VmJibGlkZnp3RzZBSmxDNVJvRTRqUT09#success";
      
      // Manejar territorios múltiples - solo números
      let territorioNumero = "";
      if (entrada.territorio_ids && entrada.territorio_ids.length > 0) {
        const nums = entrada.territorio_ids
          .map(id => territorios.find(t => t.id === id)?.numero)
          .filter(Boolean);
        territorioNumero = nums.join(", ");
      } else if (entrada.territorio_id) {
        territorioNumero = territorios.find(t => t.id === entrada.territorio_id)?.numero || "";
      }

      const capitan = participantes.find(p => p.id === entrada.capitan_id);

      // Si es por grupos - crear líneas individuales
      if (entrada.es_por_grupos && entrada.asignaciones_grupos) {
        const asignaciones = entrada.asignaciones_grupos;
        const gruposLineas: AsignacionGrupoLinea[] = [];
        
        // Agrupar por salida_index
        const porSalida: Record<number, { grupos: string[]; terrNum: string; capitanNombre: string; puntoNombre: string }> = {};
        
        asignaciones.forEach(a => {
          const idx = a.salida_index ?? 0;
          const grupo = gruposPredicacion.find(g => g.id === a.grupo_id);
          if (grupo) {
            if (!porSalida[idx]) {
              porSalida[idx] = { grupos: [], terrNum: "", capitanNombre: "", puntoNombre: punto?.nombre || "" };
            }
            porSalida[idx].grupos.push(grupo.numero.toString());
            if (a.territorio_id) {
              porSalida[idx].terrNum = territorios.find(t => t.id === a.territorio_id)?.numero || "";
            }
            if (a.capitan_id) {
              const cap = participantes.find(p => p.id === a.capitan_id);
              porSalida[idx].capitanNombre = cap ? `${cap.nombre} ${cap.apellido}` : "";
            }
          }
        });

        // Convertir a líneas
        Object.values(porSalida).forEach(salida => {
          gruposLineas.push({
            grupo: `G${salida.grupos.join(" - ")}`,
            territorioNum: salida.terrNum,
            puntoEncuentro: salida.puntoNombre,
            capitanNombre: salida.capitanNombre
          });
        });

        return {
          hora: horario?.hora.slice(0, 5) || "",
          puntoEncuentro: punto?.nombre || "",
          direccion: "",
          urlMaps: "",
          territorioNumero: "",
          capitan: "",
          esPorGrupos: true,
          gruposTexto: "",
          gruposLineas,
          esZoom: false,
          zoomUrl: ""
        };
      }

      return {
        hora: horario?.hora.slice(0, 5) || "",
        puntoEncuentro: punto?.nombre || "",
        direccion,
        urlMaps,
        territorioNumero,
        capitan: capitan ? `${capitan.nombre} ${capitan.apellido}` : "",
        esPorGrupos: false,
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
          mensaje: `REUNIÓN VIDA Y MINISTERIO CRISTIANO ${hora} HRS.`,
          tipo: "tarde"
        };
      }
      
      if (diaSemana === diaFinSemana) {
        const hora = diasReunionConfig.hora_fin_semana || "18:00";
        return {
          mensaje: `REUNIÓN PÚBLICA ${hora} HRS.`,
          tipo: "tarde"
        };
      }
      
      return null;
    };

    // Generar filas del programa
    const generarFilas = (): FilaDia[] => {
      return fechas.map(fecha => {
        const date = parseISO(fecha);
        const diaSemana = format(date, "EEEE", { locale: es }).toUpperCase();
        const diaNumero = format(date, "d");

        // Mensaje especial completo (todo el día)
        const mensajeEspecialCompleto = programa.find(
          p => p.fecha === fecha && p.es_mensaje_especial && p.colspan_completo
        );

        if (mensajeEspecialCompleto) {
          return {
            fecha,
            diaSemana,
            diaNumero,
            manana: null,
            tarde: null,
            mensajeCompleto: mensajeEspecialCompleto.mensaje_especial,
            mensajeManana: null,
            mensajeTarde: null
          };
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

        return {
          fecha,
          diaSemana,
          diaNumero,
          manana: entradasManana.length > 0 ? formatearEntrada(entradasManana[0]) : null,
          tarde: entradasTarde.length > 0 ? formatearEntrada(entradasTarde[0]) : null,
          mensajeCompleto: null,
          mensajeManana,
          mensajeTarde
        };
      });
    };

    const filas = generarFilas();

    const renderCeldasHorario = (entrada: EntradaFormateada | null, mensaje: string | null) => {
      if (mensaje) {
        return (
          <td colSpan={5} className="print-cell print-cell-mensaje">
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
            <td className="print-cell"></td>
          </>
        );
      }

      // Salidas por grupos - mostrar cada línea verticalmente
      if (entrada.esPorGrupos && entrada.gruposLineas.length > 0) {
        return (
          <>
            <td className="print-cell">{entrada.hora}</td>
            <td colSpan={3} className="print-cell print-cell-grupos">
              {entrada.gruposLineas.map((linea, idx) => (
                <div key={idx} className="grupo-linea">
                  <span className="grupo-num">{linea.grupo} - {linea.territorioNum}</span>
                  <span className="grupo-info"> : {linea.puntoEncuentro}</span>
                  <span className="grupo-capitan"> - {linea.capitanNombre}</span>
                </div>
              ))}
            </td>
            <td className="print-cell"></td>
          </>
        );
      }

      // Predicación por Zoom
      if (entrada.esZoom) {
        return (
          <>
            <td className="print-cell">{entrada.hora}</td>
            <td className="print-cell">{entrada.puntoEncuentro}</td>
            <td className="print-cell print-cell-dir">
              <a href={entrada.zoomUrl} target="_blank" rel="noopener noreferrer" className="zoom-link">
                {entrada.direccion || "ID: 898 9459 7707"}
              </a>
            </td>
            <td className="print-cell print-cell-terr">{entrada.territorioNumero}</td>
            <td className="print-cell">{entrada.capitan}</td>
          </>
        );
      }

      return (
        <>
          <td className="print-cell">{entrada.hora}</td>
          <td className="print-cell">{entrada.puntoEncuentro}</td>
          <td className="print-cell print-cell-dir">
            <div>{entrada.direccion}</div>
            {entrada.direccion && entrada.urlMaps && (
              <a href={entrada.urlMaps} target="_blank" rel="noopener noreferrer" className="como-llegar">
                Como llegar
              </a>
            )}
          </td>
          <td className="print-cell print-cell-terr">{entrada.territorioNumero}</td>
          <td className="print-cell">{entrada.capitan}</td>
        </>
      );
    };

    return (
      <div ref={ref} className="print-container">
        <style>{`
          @media print {
            @page {
              size: letter portrait;
              margin: 0.25in 0.15in;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
          
          .print-container {
            font-family: 'Calibri', Arial, sans-serif;
            font-size: 7pt;
            line-height: 1.15;
            width: 100%;
            max-width: 8.5in;
            margin: 0 auto;
            background: white;
            color: black;
          }
          
          .print-title {
            font-family: 'Calibri Light', 'Calibri', Arial, sans-serif;
            text-align: center;
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 4px;
            color: #1a365d;
          }
          
          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          
          .print-header-group {
            font-family: 'Calibri Light', 'Calibri', Arial, sans-serif;
            background: #1a365d !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            padding: 2px 1px;
            font-size: 8pt;
            border: 1px solid #1a365d;
          }
          
          .print-header {
            font-family: 'Calibri Light', 'Calibri', Arial, sans-serif;
            background: #2c5282 !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            padding: 1px;
            font-size: 6pt;
            border: 1px solid #1a365d;
            white-space: nowrap;
          }
          
          .print-cell {
            border: 1px solid #cbd5e0;
            padding: 1px 2px;
            text-align: center;
            vertical-align: middle;
            font-size: 7pt;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .print-cell-fecha {
            font-family: 'Calibri Light', 'Calibri', Arial, sans-serif;
            background: #e2e8f0 !important;
            text-align: center;
            font-size: 7pt;
            line-height: 1.15;
            padding: 1px;
          }
          
          .print-cell-fecha .dia-nombre {
            font-size: 6pt;
          }
          
          .print-cell-fecha .dia-numero {
            font-size: 10pt;
            font-weight: bold;
          }
          
          .print-cell-mensaje {
            background: #edf2f7 !important;
            font-weight: bold;
            text-align: center;
            font-size: 7pt;
          }
          
          .print-cell-grupos {
            text-align: left;
            font-size: 7pt;
            padding: 2px 3px;
          }
          
          .print-cell-grupos .grupo-linea {
            margin-bottom: 1px;
          }
          
          .print-cell-grupos .grupo-num {
            color: #2b6cb0;
            font-weight: bold;
          }
          
          .print-cell-grupos .grupo-info {
            color: black;
          }
          
          .print-cell-grupos .grupo-capitan {
            color: #4a5568;
          }
          
          .print-cell-terr {
            white-space: normal !important;
            word-break: break-word;
            font-size: 7pt;
            line-height: 1.15;
          }
          
          .print-cell-dir {
            font-size: 7pt;
            line-height: 1.15;
            text-align: left;
            padding-left: 3px;
          }
          
          .print-cell-dir .como-llegar {
            display: block;
            font-size: 6pt;
            color: #2b6cb0;
            text-decoration: underline;
          }
          
          .print-cell-dir .zoom-link {
            color: #2b6cb0;
            text-decoration: underline;
          }
          
          .print-row-alt {
            background: #f7fafc !important;
          }
          
          /* Anchos de columna optimizados - Total: 100% */
          /* FECHA: 6.5% | MAÑANA: 46.75% | TARDE: 46.75% */
          /* Por horario: HORA 4% | PUNTO 12% | DIR 16% | TERR 4.75% | CAPITAN 10% = 46.75% */
        `}</style>
        
        <div className="print-title">
          PROGRAMA DE PREDICACIÓN - {mesAnio.toUpperCase()}
        </div>
        
        <table className="print-table">
          <colgroup>
            <col style={{ width: "6.5%" }} /> {/* FECHA */}
            {/* MAÑANA */}
            <col style={{ width: "4%" }} /> {/* HORA */}
            <col style={{ width: "13%" }} /> {/* PUNTO */}
            <col style={{ width: "15%" }} /> {/* DIRECCIÓN */}
            <col style={{ width: "4.75%" }} /> {/* TERR */}
            <col style={{ width: "10%" }} /> {/* CAPITÁN */}
            {/* TARDE */}
            <col style={{ width: "4%" }} /> {/* HORA */}
            <col style={{ width: "13%" }} /> {/* PUNTO */}
            <col style={{ width: "15%" }} /> {/* DIRECCIÓN */}
            <col style={{ width: "4.75%" }} /> {/* TERR */}
            <col style={{ width: "10%" }} /> {/* CAPITÁN */}
          </colgroup>
          <thead>
            <tr>
              <th className="print-header-group" rowSpan={2}>FECHA</th>
              <th className="print-header-group" colSpan={5}>HORARIO MAÑANA</th>
              <th className="print-header-group" colSpan={5}>HORARIO TARDE</th>
            </tr>
            <tr>
              <th className="print-header">HORA</th>
              <th className="print-header">PUNTO ENCUENTRO</th>
              <th className="print-header">DIRECCIÓN</th>
              <th className="print-header">TERR.</th>
              <th className="print-header">CAPITÁN</th>
              <th className="print-header">HORA</th>
              <th className="print-header">PUNTO ENCUENTRO</th>
              <th className="print-header">DIRECCIÓN</th>
              <th className="print-header">TERR.</th>
              <th className="print-header">CAPITÁN</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, idx) => (
              <tr key={fila.fecha} className={idx % 2 === 1 ? "print-row-alt" : ""}>
                <td className="print-cell print-cell-fecha">
                  <div className="dia-nombre">{fila.diaSemana}</div>
                  <div className="dia-numero">{fila.diaNumero}</div>
                </td>
                {fila.mensajeCompleto ? (
                  <td colSpan={10} className="print-cell print-cell-mensaje">
                    {fila.mensajeCompleto}
                  </td>
                ) : (
                  <>
                    {renderCeldasHorario(fila.manana, fila.mensajeManana)}
                    {renderCeldasHorario(fila.tarde, fila.mensajeTarde)}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

ImpresionPrograma.displayName = "ImpresionPrograma";
