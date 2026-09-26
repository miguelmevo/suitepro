import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio, etiquetaPuntoPorModalidad, esIndividualSinDetalle, CAPITAN_POR_GRUPO, ETIQUETA_INDIVIDUAL_SIN_DETALLE } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";

/**
 * Datos del programa de Predicación ya ordenados en filas (una fila por salida).
 * Los usan la impresión/vista previa (ImpresionPrograma) y el PDF dibujado
 * (pdfProgramaPredicacion), para que ambos muestren exactamente lo mismo.
 */

export interface DiasReunionConfig {
  dia_entre_semana?: string;
  hora_entre_semana?: string;
  dia_fin_semana?: string;
  hora_fin_semana?: string;
}

export interface MensajeAdicional {
  id: string;
  fecha: string;
  mensaje: string;
  color: string;
}

export interface FilaPrograma {
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

export interface AsignacionGrupoLinea {
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

export interface EntradaFormateada {
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


export interface ParametrosFilasPrograma {
  programa: ProgramaConDetalles[];
  horarios: HorarioSalida[];
  fechas: string[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  gruposPredicacion: GrupoPredicacion[];
  mensajesAdicionales?: MensajeAdicional[];
  diasReunionConfig?: DiasReunionConfig;
}

export function generarFilasPrograma({
  programa,
  horarios,
  fechas,
  puntos,
  territorios,
  participantes,
  gruposPredicacion,
  mensajesAdicionales,
  diasReunionConfig,
}: ParametrosFilasPrograma): FilaPrograma[] {
  // Clasificar horarios (respeta `franja` del horario, fallback por nombre/hora)
  const clasificarHorario = (horario: HorarioSalida): "manana" | "tarde" => {
    const franja = (horario as { franja?: string }).franja;
    if (franja === "manana" || franja === "tarde") return franja;
    const nombreLower = horario.nombre.toLowerCase();
    if (nombreLower.includes("mañana") || nombreLower.includes("manana")) return "manana";
    if (nombreLower.includes("tarde")) return "tarde";
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
    const zoomUrl = urlMaps || "";
    
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
      const asignaciones = entrada.asignaciones_grupos.filter(a => !a.disabled);
      
      // Detectar si es "por grupo individual": sin capitán = cada grupo sale por su cuenta
      // Se muestra horizontal compacto: G1: 5 / G2: 2 / G3: 17...
      const tieneCapitan = asignaciones.some(a => a.capitan_id);
      const esPorGrupoIndividual = asignaciones.length > 0 && !tieneCapitan;
      
      if (esPorGrupoIndividual) {
        // Formato: G1: 5 / G2: 6 / G3: 7...
        const gruposLineas = asignaciones
          .map(a => {
            const grupo = gruposPredicacion.find(g => g.id === a.grupo_id);
            const esFicticio = !!a.grupo_ficticio_id;
            const terr = a.territorio_id 
              ? territorios.find(t => t.id === a.territorio_id)
              : null;
            return {
              grupos: esFicticio ? (a.grupo_ficticio_nombre || "?") : `G${grupo?.numero || "?"}`,
              _orden: esFicticio ? 9999 : (grupo?.numero || 0),
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
          .sort((a, b) => a._orden - b._orden);

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
        puntoEncuentro: punto?.nombre || etiquetaPuntoPorModalidad(entrada.modalidad),
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

    // Salida por grupo individual sin detalle por grupo (cartas / teléfono):
    // no hay punto ni capitán únicos, cada grupo sale con su superintendente.
    const individualSinDetalle = esIndividualSinDetalle(entrada);

    return {
      hora: horario?.hora.slice(0, 5) || "",
      grupos: gruposLabel,
      // El territorio va en su propia columna, así que acá sólo el encabezado.
      puntoEncuentro: individualSinDetalle
        ? ETIQUETA_INDIVIDUAL_SIN_DETALLE
        : punto?.nombre || etiquetaPuntoPorModalidad(entrada.modalidad),
      direccion,
      urlMaps,
      territorioNumero,
      territorioImagenUrl,
      territorioIds: entrada.territorio_ids || (entrada.territorio_id ? [entrada.territorio_id] : []),
      capitan: individualSinDetalle
        ? CAPITAN_POR_GRUPO
        : capitan ? `${capitan.nombre} ${capitan.apellido}` : "",
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
      const horaNum = parseInt(hora.split(":")[0], 10);
      return {
        mensaje: `REUNIÓN PÚBLICA ${hora} HRAS.`,
        tipo: horaNum < 12 ? "manana" : "tarde"
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

  return generarFilas();
}
