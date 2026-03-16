import React, { forwardRef, useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth, getDay, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { getColorTheme } from "@/lib/congregation-colors";

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

interface ImpresionProgramaCalendarioProps {
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
  colorTema?: string;
}

interface DiaCalendario {
  fecha: Date;
  fechaStr: string;
  esMesActual: boolean;
  bloqueManana: BloqueHorario | null;
  bloqueTarde: BloqueHorario | null;
  reunion: { texto: string; textoLineas: string[]; hora: string; tipo: "manana" | "tarde" } | null;
  mensajeEspecial: string | null;
  mensajeAdicional: { mensaje: string; color: string } | null;
  esPorGrupos: boolean;
  asignacionesGrupos: AsignacionGrupoCalendario[];
}

interface BloqueHorario {
  salida: string;
  capitan: string;
  territorios: string;
  territorioIds: string[];
  hora: string;
}

interface AsignacionGrupoCalendario {
  grupoNumero: string;
  salida: string;
  puntoNombre: string;
  territorios: string;
  territorioIds: string[];
  capitan: string;
}

interface PuntoSalida {
  numero: number;
  nombre: string;
  direccion: string;
  url_maps: string;
}

export const ImpresionProgramaCalendario = forwardRef<HTMLDivElement, ImpresionProgramaCalendarioProps>(
  ({ programa, horarios, fechas, puntos, territorios, participantes, gruposPredicacion, diasEspeciales, mensajesAdicionales, diasReunionConfig, mesAnio, colorTema = "blue" }, ref) => {
    
    const theme = getColorTheme(colorTema);
    const pdfColors = theme.pdf;

    // Classify schedules
    const clasificarHorario = (horario: HorarioSalida): "manana" | "tarde" => {
      const nombreLower = horario.nombre.toLowerCase();
      if (nombreLower.includes("mañana") || nombreLower.includes("manana")) return "manana";
      if (nombreLower.includes("tarde")) return "tarde";
      const hora = parseInt(horario.hora.split(":")[0], 10);
      return hora < 12 ? "manana" : "tarde";
    };

    const horariosManana = horarios.filter(h => clasificarHorario(h) === "manana");
    const horariosTarde = horarios.filter(h => clasificarHorario(h) === "tarde");

    // Get meeting info for a date
    const getMensajeReunion = (fecha: string): { texto: string; textoLineas: string[]; hora: string; tipo: "manana" | "tarde" } | null => {
      if (!diasReunionConfig) return null;
      const date = parseISO(fecha);
      const diaSemana = format(date, "EEEE", { locale: es }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizar = (dia: string) => dia?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
      
      if (diaSemana === normalizar(diasReunionConfig.dia_fin_semana || "")) {
        const hora = diasReunionConfig.hora_fin_semana || "10:00";
        const horaNum = parseInt(hora.split(":")[0], 10);
        return { texto: `REUNIÓN PÚBLICA`, textoLineas: ["REUNIÓN PÚBLICA", `${hora.slice(0, 5)} HORAS`], hora, tipo: horaNum < 12 ? "manana" : "tarde" };
      }
      if (diaSemana === normalizar(diasReunionConfig.dia_entre_semana || "")) {
        const hora = diasReunionConfig.hora_entre_semana || "19:30";
        return { texto: `REUNIÓN VIDA Y MINISTERIO CRISTIANO`, textoLineas: ["REUNIÓN VIDA Y", "MINISTERIO CRISTIANO", `${hora.slice(0, 5)} HORAS`], hora, tipo: "tarde" };
      }
      return null;
    };

    // Build calendar data
    const { diasCalendario, semanasCalendario, puntosSalida, sabadosPorGrupos } = useMemo(() => {
      if (fechas.length === 0) return { diasCalendario: [], semanasCalendario: [], puntosSalida: [], sabadosPorGrupos: [] };

      const primerDia = parseISO(fechas[0]);
      const ultimoDia = parseISO(fechas[fechas.length - 1]);
      const mesNum = primerDia.getMonth();
      
      // Calendar grid: start from Monday of the week containing the 1st
      const inicioGrid = startOfWeek(startOfMonth(primerDia), { weekStartsOn: 1 });
      const finGrid = endOfWeek(endOfMonth(primerDia), { weekStartsOn: 1 });
      const todosDias = eachDayOfInterval({ start: inicioGrid, end: finGrid });

      // Collect unique puntos for the "Salida de Grupo" table
      const puntosUsados = new Map<string, PuntoSalida>();
      
      // Track sábados por grupos
      const sabadosGrupos: { fecha: string; asignaciones: AsignacionGrupoCalendario[] }[] = [];

      const dias: DiaCalendario[] = todosDias.map(dia => {
        const fechaStr = format(dia, "yyyy-MM-dd");
        const esMesActual = dia.getMonth() === mesNum;
        
        if (!esMesActual) {
          return {
            fecha: dia, fechaStr, esMesActual, bloqueManana: null, bloqueTarde: null,
            reunion: null, mensajeEspecial: null, mensajeAdicional: null, esPorGrupos: false, asignacionesGrupos: []
          };
        }

        // Special message (full day)
        const msgEspecialCompleto = programa.find(p => p.fecha === fechaStr && p.es_mensaje_especial && p.colspan_completo);
        if (msgEspecialCompleto) {
          return {
            fecha: dia, fechaStr, esMesActual, bloqueManana: null, bloqueTarde: null,
            reunion: null, mensajeEspecial: msgEspecialCompleto.mensaje_especial || "", mensajeAdicional: null,
            esPorGrupos: false, asignacionesGrupos: []
          };
        }

        // Additional message
        const msgAdicional = mensajesAdicionales?.find(m => m.fecha === fechaStr);

        // Morning entries
        const horarioMananaIds = horariosManana.map(h => h.id);
        const horarioTardeIds = horariosTarde.map(h => h.id);

        const entradasManana = programa.filter(
          p => p.fecha === fechaStr && p.horario_id && horarioMananaIds.includes(p.horario_id) && !p.es_mensaje_especial
        );
        const entradasTarde = programa.filter(
          p => p.fecha === fechaStr && p.horario_id && horarioTardeIds.includes(p.horario_id) && !p.es_mensaje_especial
        );

        // Meeting
        const reunion = getMensajeReunion(fechaStr);

        // Check if "por grupos" (in any time slot)
        const allEntradas = [...entradasManana, ...entradasTarde];
        const entradaGrupos = allEntradas.find(e => e.es_por_grupos && e.asignaciones_grupos && e.asignaciones_grupos.length > 0);
        
        let esPorGrupos = false;
        let asignacionesGrupos: AsignacionGrupoCalendario[] = [];
        let bloqueManana: BloqueHorario | null = null;

        if (entradaGrupos) {
          esPorGrupos = true;
          const asigs = entradaGrupos.asignaciones_grupos || [];
          const esPorGrupoIndividual = asigs.every(a => a.salida_index === undefined || a.salida_index === 0);
          
          if (esPorGrupoIndividual) {
            // "Predicación por grupos" - each group has its own territory
            asignacionesGrupos = asigs.map(a => {
              const grupo = gruposPredicacion.find(g => g.id === a.grupo_id);
              const terr = a.territorio_id ? territorios.find(t => t.id === a.territorio_id) : null;
              const cap = a.capitan_id ? participantes.find(p => p.id === a.capitan_id) : null;
              const puntoAsig = a.punto_encuentro_id ? puntos.find(p => p.id === a.punto_encuentro_id) : null;
              const salidaLabel = puntoAsig 
                ? (puntoAsig.numero_salida ? `Salida ${puntoAsig.numero_salida}` : puntoAsig.nombre) 
                : "";
              
              // Track punto usage for bottom table
              if (puntoAsig) {
                if (!puntosUsados.has(puntoAsig.id)) {
                  puntosUsados.set(puntoAsig.id, { 
                    numero: puntoAsig.numero_salida || 0, 
                    nombre: puntoAsig.nombre, 
                    direccion: puntoAsig.direccion || "",
                    url_maps: puntoAsig.url_maps || ""
                  });
                }
              }
              
              return {
                grupoNumero: `${grupo?.numero || "?"}`,
                salida: salidaLabel,
                puntoNombre: salidaLabel,
                territorios: terr?.numero || "",
                territorioIds: a.territorio_id ? [a.territorio_id] : [],
                capitan: cap ? `${cap.nombre} ${cap.apellido}` : ""
              };
            }).sort((a, b) => parseInt(a.grupoNumero) - parseInt(b.grupoNumero));
            
            // Collect for bottom section
            sabadosGrupos.push({ fecha: fechaStr, asignaciones: asignacionesGrupos });
          } else {
            // "Grupo General" or grouped by salida_index
            const porSalida: Record<number, { grupos: string[]; terrNum: string; terrIds: string[]; puntoNombre: string; capitanNombre: string }> = {};
            asigs.forEach(a => {
              const idx = a.salida_index ?? 0;
              const grupo = gruposPredicacion.find(g => g.id === a.grupo_id);
              if (grupo) {
                if (!porSalida[idx]) {
                  const puntoAsig = a.punto_encuentro_id ? puntos.find(p => p.id === a.punto_encuentro_id) : null;
                  const salidaLabel = puntoAsig 
                    ? (puntoAsig.numero_salida ? `SALIDA ${puntoAsig.numero_salida}` : puntoAsig.nombre) 
                    : "";
                  porSalida[idx] = { grupos: [], terrNum: "", terrIds: [], puntoNombre: salidaLabel, capitanNombre: "" };
                  // Track punto usage
                  if (puntoAsig && !puntosUsados.has(puntoAsig.id)) {
                    puntosUsados.set(puntoAsig.id, { numero: puntoAsig.numero_salida || 0, nombre: puntoAsig.nombre, direccion: puntoAsig.direccion || "", url_maps: puntoAsig.url_maps || "" });
                  }
                }
                porSalida[idx].grupos.push(grupo.numero.toString());
                if (a.territorio_id) {
                  const terr = territorios.find(t => t.id === a.territorio_id);
                  porSalida[idx].terrNum = terr?.numero || "";
                  porSalida[idx].terrIds = [a.territorio_id];
                }
                if (a.capitan_id) {
                  const cap = participantes.find(p => p.id === a.capitan_id);
                  porSalida[idx].capitanNombre = cap ? `${cap.nombre} ${cap.apellido}` : "";
                }
              }
            });

            asignacionesGrupos = Object.entries(porSalida)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([, s]) => ({
                grupoNumero: s.grupos.sort((a, b) => parseInt(a) - parseInt(b)).join("-"),
                salida: s.puntoNombre,
                puntoNombre: s.puntoNombre,
                territorios: s.terrNum,
                territorioIds: s.terrIds,
                capitan: s.capitanNombre
              }));
            
            // Collect for bottom section (same as individual)
            sabadosGrupos.push({ fecha: fechaStr, asignaciones: asignacionesGrupos });
          }
        } else if (entradasManana.length > 0) {
          // Normal entry
          const entrada = entradasManana[0];
          const horario = horarios.find(h => h.id === entrada.horario_id);
          const punto = puntos.find(p => p.id === entrada.punto_encuentro_id);
          const capitan = participantes.find(p => p.id === entrada.capitan_id);
          
          let terrNums = "";
          if (entrada.territorio_ids && entrada.territorio_ids.length > 0) {
            terrNums = entrada.territorio_ids
              .map(id => territorios.find(t => t.id === id))
              .filter((t): t is Territorio => !!t)
              .sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
              .map(t => t.numero)
              .join(",");
          }

          // Track punto usage
          if (punto && !puntosUsados.has(punto.id)) {
            puntosUsados.set(punto.id, { numero: punto.numero_salida || 0, nombre: punto.nombre, direccion: punto.direccion || "", url_maps: punto.url_maps || "" });
          }

          const capitanNombre = capitan ? `${capitan.nombre} ${capitan.apellido}` : "";
          const salida = punto 
            ? (punto.numero_salida ? `SALIDA ${punto.numero_salida}` : punto.nombre)
            : "";
          
          bloqueManana = {
            salida,
            capitan: capitanNombre,
            territorios: terrNums,
            hora: horario?.hora.slice(0, 5) || ""
          };
        }

        // Tarde
        let bloqueTarde: BloqueHorario | null = null;
        if (entradasTarde.length > 0) {
          const entrada = entradasTarde[0];
          const horario = horarios.find(h => h.id === entrada.horario_id);
          const punto = puntos.find(p => p.id === entrada.punto_encuentro_id);
          const capitan = participantes.find(p => p.id === entrada.capitan_id);
          
          let terrNums = "";
          if (entrada.territorio_ids && entrada.territorio_ids.length > 0) {
            terrNums = entrada.territorio_ids
              .map(id => territorios.find(t => t.id === id))
              .filter((t): t is Territorio => !!t)
              .sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
              .map(t => t.numero)
              .join(",");
          }

          if (punto && !puntosUsados.has(punto.id)) {
            puntosUsados.set(punto.id, { numero: punto.numero_salida || 0, nombre: punto.nombre, direccion: punto.direccion || "", url_maps: punto.url_maps || "" });
          }

          const capitanNombre = capitan ? `${capitan.nombre} ${capitan.apellido}` : "";
          
          const salidaTarde = punto 
            ? (punto.numero_salida ? `SALIDA ${punto.numero_salida}` : punto.nombre)
            : "";
          bloqueTarde = {
            salida: salidaTarde,
            capitan: capitanNombre,
            territorios: terrNums,
            hora: horario?.hora.slice(0, 5) || ""
          };
        }

        return {
          fecha: dia,
          fechaStr,
          esMesActual,
          bloqueManana,
          bloqueTarde,
          reunion: reunion ? { texto: reunion.texto, textoLineas: reunion.textoLineas, hora: reunion.hora, tipo: reunion.tipo } : null,
          mensajeEspecial: null,
          mensajeAdicional: msgAdicional ? { mensaje: msgAdicional.mensaje, color: msgAdicional.color } : null,
          esPorGrupos,
          asignacionesGrupos
        };
      });

      // Split into weeks
      const semanas: DiaCalendario[][] = [];
      for (let i = 0; i < dias.length; i += 7) {
        semanas.push(dias.slice(i, i + 7));
      }

      // Sort puntos by numero
      const sortedPuntos = Array.from(puntosUsados.values()).sort((a, b) => a.numero - b.numero);

      return { diasCalendario: dias, semanasCalendario: semanas, puntosSalida: sortedPuntos, sabadosPorGrupos: sabadosGrupos };
    }, [programa, horarios, fechas, puntos, territorios, participantes, gruposPredicacion, diasEspeciales, mensajesAdicionales, diasReunionConfig]);

    // Get morning schedule name - format "Mañana: 09:30 horas"
    const horarioMananaNombre = horariosManana.length > 0 
      ? `Mañana: ${horariosManana[0].hora.slice(0, 5)} horas`
      : "Mañana: 09:30 horas";

    const horarioTardeNombre = horariosTarde.length > 0
      ? `Tarde: ${horariosTarde[0].hora.slice(0, 5)} horas`
      : "Tarde: 19:00 horas";

    const DIAS_NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    return (
      <div ref={ref} className="cal-print-container">
        <style>{`
          @page {
            size: letter portrait;
            margin: 3mm 5mm;
          }
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { margin: 0; padding: 0; background: white !important; }
            .cal-print-container { padding: 2mm 3mm !important; }
          }
          .cal-print-container {
            font-family: 'Calibri', Arial, sans-serif;
            font-size: 9pt;
            line-height: 1.2;
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            padding: 8px;
            background: white;
            color: black;
            box-sizing: border-box;
          }
          @media print {
            .cal-print-container { font-size: 6.5pt; line-height: 1.15; width: 200mm; padding: 2mm 3mm; }
          }
          .cal-title {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 6px;
            color: ${pdfColors.title};
          }
          @media print { .cal-title { font-size: 10pt; margin-bottom: 3px; } }
          
          .cal-grid {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            border: 1.5pt solid ${pdfColors.headerDark};
          }
          .cal-grid th {
            background: ${pdfColors.headerDark} !important;
            color: white !important;
            font-weight: bold;
            text-align: center;
            padding: 4px 2px;
            font-size: 10pt;
            border: 1pt solid ${pdfColors.headerDark};
          }
          @media print { .cal-grid th { font-size: 7pt; padding: 2px 1px; } }
          
          .cal-cell-full {
            border: 0.5pt solid #ccc;
            vertical-align: top;
            padding: 0;
            width: 14.28%;
          }
          @media print { .cal-cell-full { min-height: 20px; } }
          
          .cal-cell-manana {
            border: 0.5pt solid #ccc;
            vertical-align: top;
            padding: 3px 5px 2px 5px;
            width: 14.28%;
          }
          .cal-cell-tarde {
            border: 0.5pt solid #ccc;
            border-top: none;
            vertical-align: top;
            padding: 2px 5px 3px 5px;
            width: 14.28%;
          }
          .cal-cell-outside-manana, .cal-cell-outside-tarde {
            border: 0.5pt solid #ccc;
            background: #f5f5f5 !important;
            width: 14.28%;
          }
          @media print {
            .cal-cell-manana { padding: 2px 3px 1px 3px; }
            .cal-cell-tarde { padding: 1px 3px 2px 3px; border-top: none; }
          }
          
          
          
          .cal-day-number {
            font-weight: bold;
            font-size: 10pt;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 16px;
            min-height: 16px;
            padding: 0 3px;
            border-radius: 3px;
            margin-left: 3px;
            margin-right: 4px;
            margin-top: 2px;
            margin-bottom: 1px;
            vertical-align: middle;
          }
          @media print { .cal-day-number { font-size: 7pt; padding: 0 2px; min-width: 12px; min-height: 12px; margin-left: 2px; margin-right: 3px; } }
          
          .cal-horario-label {
            font-weight: bold;
            font-size: 7pt;
            color: ${pdfColors.headerDark};
            margin-bottom: 4px;
          }
          @media print { .cal-horario-label { font-size: 5.5pt; margin-bottom: 2px; } }
          
          .cal-entry {
            font-size: 9pt;
            line-height: 1.3;
          }
          @media print { .cal-entry { font-size: 6pt; line-height: 1.2; } }
          
          .cal-salida { font-weight: bold; font-size: 9.5pt; margin-bottom: 3px; }
          @media print { .cal-salida { font-size: 6.5pt; margin-bottom: 2px; } }
          
          .cal-capitan { font-size: 8pt; color: #333; margin-bottom: 2px; }
          @media print { .cal-capitan { font-size: 5.5pt; margin-bottom: 1px; } }
          
          .cal-terr { font-size: 8pt; color: #555; }
          @media print { .cal-terr { font-size: 5.5pt; } }
          
          .cal-tarde-divider {
            display: none;
          }
          
          .cal-tarde-label {
            font-weight: bold;
            font-size: 7pt;
            color: ${pdfColors.headerDark};
            margin-bottom: 4px;
          }
          @media print { .cal-tarde-label { font-size: 5.5pt; margin-bottom: 2px; } }
          
          .cal-especial {
            font-weight: bold;
            text-align: center;
            font-size: 7.5pt;
            color: ${pdfColors.headerDark};
            padding-top: 4px;
          }
          @media print { .cal-especial { font-size: 5.5pt; } }
          
          .cal-reunion {
            font-weight: bold;
            font-size: 7.5pt;
            color: ${pdfColors.headerDark};
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 1;
            background: ${pdfColors.headerDark}15;
            border-radius: 2px;
            padding: 2px 4px;
            line-height: 1.3;
          }
          @media print { .cal-reunion { font-size: 5.5pt; padding: 1px 2px; } }
          
          .cal-por-grupos {
            font-weight: bold;
            font-size: 7.5pt;
            color: ${pdfColors.headerDark};
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            flex: 1;
          }
          .cal-por-grupos a {
            color: ${pdfColors.headerDark};
            text-decoration: none;
          }
          @media print { .cal-por-grupos { font-size: 5.5pt; } }
          
          /* Bottom sections */
          .cal-bottom-section {
            margin-top: 8px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          @media print { .cal-bottom-section { margin-top: 4px; gap: 6px; } }
          
          .cal-bottom-table {
            border-collapse: collapse;
            font-size: 10pt;
            border: 1.5pt solid ${pdfColors.headerDark};
            border-radius: 4px;
            overflow: hidden;
          }
          @media print { .cal-bottom-table { font-size: 7pt; } }
          
          .cal-bottom-table th {
            background: ${pdfColors.headerDark} !important;
            color: white !important;
            font-weight: bold;
            padding: 5px 8px;
            text-align: left;
            font-size: 10.5pt;
            border: none;
            border-right: 0.1pt solid rgba(255,255,255,0.3);
          }
          .cal-bottom-table th:last-child { border-right: none; }
          @media print { .cal-bottom-table th { padding: 2px 4px; font-size: 7pt; } }
          
          .cal-bottom-table td {
            padding: 4px 8px;
            border: 0.1pt solid #e0e0e0;
            border-left: 0.1pt solid #e0e0e0;
            border-right: 0.1pt solid #e0e0e0;
            font-size: 10pt;
          }
          .cal-bottom-table td:first-child { border-left: none; }
          .cal-bottom-table td:last-child { border-right: none; }
          .cal-bottom-table tr:last-child td { border-bottom: none; }
          @media print { .cal-bottom-table td { padding: 2px 4px; font-size: 6.5pt; } }
          
          .cal-bottom-table a.cal-link-direccion {
            color: ${pdfColors.link};
            text-decoration: none;
          }
          
          .cal-grupos-section {
            font-size: 10pt;
            border: 1.5pt solid ${pdfColors.headerDark};
            border-radius: 4px;
            padding: 8px 10px;
            margin-top: 4px;
            flex: 1;
          }
          @media print { .cal-grupos-section { font-size: 7pt; padding: 4px 6px; margin-top: 2px; } }
          
          .cal-grupos-section h4 {
            font-weight: bold;
            font-size: 11pt;
            margin-bottom: 6px;
            color: ${pdfColors.title};
            border-bottom: 1pt solid ${pdfColors.headerDark};
            padding-bottom: 3px;
          }
          @media print { .cal-grupos-section h4 { font-size: 7.5pt; margin-bottom: 3px; padding-bottom: 1px; } }
          
          .cal-grupos-fecha {
            font-weight: bold;
            font-size: 10pt;
            margin-top: 6px;
          }
          @media print { .cal-grupos-fecha { font-size: 7pt; margin-top: 3px; } }
          
          .cal-grupos-asignacion {
            font-size: 9.5pt;
            padding-left: 10px;
            margin-top: 2px;
            line-height: 1.4;
          }
          @media print { .cal-grupos-asignacion { font-size: 6.5pt; padding-left: 6px; margin-top: 1px; } }
        `}</style>

        <div className="cal-title">
          Calendario de predicación {mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1)}
        </div>

        <table className="cal-grid">
          <thead>
            <tr>
              {DIAS_NOMBRES.map(dia => (
                <th key={dia}>{dia}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanasCalendario.map((semana, sIdx) => {
              return (
                <React.Fragment key={sIdx}>
                  {/* ── MAÑANA ROW ── */}
                  <tr>
                    {semana.map((dia, dIdx) => {
                      if (!dia.esMesActual) {
                        return <td key={dIdx} className="cal-cell-outside-manana" />;
                      }

                      const diaNum = format(dia.fecha, "d");
                      const reunionEsManana = dia.reunion?.tipo === "manana";
                      const esPorGruposCalendario = dia.esPorGrupos && dia.asignacionesGrupos.length > 0;

                      // Special message spans both rows
                      if (dia.mensajeEspecial) {
                        return (
                          <td key={dIdx} className="cal-cell-manana" rowSpan={2} style={{ verticalAlign: "middle" }}>
                            <span className="cal-day-number">{diaNum}</span>
                            <div className="cal-especial">{dia.mensajeEspecial}</div>
                          </td>
                        );
                      }

                      return (
                        <td key={dIdx} className="cal-cell-manana">
                          {reunionEsManana ? (
                            <>
                              <div style={{ marginBottom: "2px" }}><span className="cal-day-number">{diaNum}</span></div>
                              <div className="cal-reunion">
                                <div>
                                  {dia.reunion!.textoLineas.map((linea, li) => (
                                    <div key={li}>{linea}</div>
                                  ))}
                                </div>
                              </div>
                            </>
                          ) : esPorGruposCalendario ? (
                            <>
                              <div className="cal-horario-label">
                                <span className="cal-day-number">{diaNum}</span>
                                {horarioMananaNombre}
                              </div>
                              <div className="cal-por-grupos">
                                <a href="#pred-por-grupos">
                                  PREDICACIÓN<br/>POR GRUPOS
                                </a>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="cal-horario-label">
                                <span className="cal-day-number">{diaNum}</span>
                                {dia.bloqueManana ? horarioMananaNombre : "\u00A0"}
                              </div>
                              <div className="cal-entry">
                                <div className="cal-salida">{dia.bloqueManana?.salida ? dia.bloqueManana.salida.toUpperCase() : "\u00A0"}</div>
                                <div className="cal-capitan">{dia.bloqueManana?.capitan ? `C: ${dia.bloqueManana.capitan}` : "\u00A0"}</div>
                                <div className="cal-terr">{dia.bloqueManana?.territorios ? `T: ${dia.bloqueManana.territorios}` : "\u00A0"}</div>
                              </div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* ── TARDE ROW ── */}
                  <tr>
                    {semana.map((dia, dIdx) => {
                      if (!dia.esMesActual) {
                        return <td key={dIdx} className="cal-cell-outside-tarde" />;
                      }

                      // Skip if mensajeEspecial (already rowSpan=2)
                      if (dia.mensajeEspecial) {
                        return null;
                      }

                      const reunionEsTarde = dia.reunion?.tipo === "tarde";

                      return (
                        <td key={dIdx} className="cal-cell-tarde">
                          {reunionEsTarde ? (
                            <div className="cal-reunion">
                              <div>
                                {dia.reunion!.textoLineas.map((linea, li) => (
                                  <div key={li}>{linea}</div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="cal-tarde-label">{dia.bloqueTarde ? horarioTardeNombre : "\u00A0"}</div>
                              <div className="cal-entry">
                                <div className="cal-salida">{dia.bloqueTarde?.salida ? dia.bloqueTarde.salida.toUpperCase() : "\u00A0"}</div>
                                <div className="cal-capitan">{dia.bloqueTarde?.capitan ? `C: ${dia.bloqueTarde.capitan}` : "\u00A0"}</div>
                                <div className="cal-terr">{dia.bloqueTarde?.territorios ? `T: ${dia.bloqueTarde.territorios}` : "\u00A0"}</div>
                              </div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Bottom sections - two column layout */}
        {(puntosSalida.length > 0 || sabadosPorGrupos.length > 0) && (
          <div id="pred-por-grupos" className="cal-bottom-section" style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            {/* Left half: Puntos de encuentro table */}
            <div style={{ flex: "1", minWidth: 0 }}>
              {puntosSalida.length > 0 && (
                <table className="cal-bottom-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Nro.<br/>Salida</th>
                      <th>Punto de Encuentro</th>
                      <th>Dirección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puntosSalida.map((punto, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: "center", width: "50px" }}>{punto.numero || "-"}</td>
                        <td>{punto.nombre}</td>
                        <td>
                          {punto.url_maps ? (
                            <a href={punto.url_maps} target="_blank" rel="noopener noreferrer" className="cal-link-direccion">
                              {punto.direccion}
                            </a>
                          ) : punto.direccion}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right half: Predicación por grupos - max 2 columns per row */}
            {sabadosPorGrupos.length > 0 && (
              <div style={{ flex: "1", minWidth: 0 }}>
                <div className="cal-grupos-section" style={{ margin: 0 }}>
                  <h4>Predicación por grupos</h4>
                  {(() => {
                    // Group into rows of 2
                    const rows: typeof sabadosPorGrupos[] = [];
                    for (let i = 0; i < sabadosPorGrupos.length; i += 2) {
                      rows.push(sabadosPorGrupos.slice(i, i + 2));
                    }
                    return rows.map((row, rIdx) => (
                      <div key={rIdx} style={{ display: "flex", gap: "16px", marginBottom: rIdx < rows.length - 1 ? "10px" : 0 }}>
                        {row.map((sabado, cIdx) => {
                          const fechaFormateada = format(parseISO(sabado.fecha), "EEEE d 'de' MMMM", { locale: es });
                          return (
                            <div key={cIdx} style={{ flex: "1", minWidth: 0 }}>
                              <div className="cal-grupos-fecha" style={{ textTransform: "capitalize" }}>
                                {fechaFormateada}:
                              </div>
                              {sabado.asignaciones.map((a, aIdx) => (
                                <div key={aIdx} className="cal-grupos-asignacion">
                                  <strong>Grupo {a.grupoNumero}:</strong>
                                  {a.puntoNombre && ` ${a.puntoNombre}`}
                                  {a.territorios && `    T: ${a.territorios}`}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                        {row.length === 1 && <div style={{ flex: "1" }} />}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

ImpresionProgramaCalendario.displayName = "ImpresionProgramaCalendario";
