import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import type { ProgramaVidaMinisterio } from "@/types/vida-ministerio";

/**
 * Modelo de una semana de la reunión de Vida y Ministerio, listo para dibujar
 * (PDF): horas encadenadas, títulos con sus minutos y quién va en cada parte.
 * Reproduce las reglas de ImpresionVidaMinisterio (la hoja impresa); si cambian
 * allá (duraciones por defecto, orden de la visita del superintendente, etc.)
 * hay que cambiarlas también acá. Ver docs/pdf-vida-ministerio.md.
 */

const DIA_SEMANA_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export const COLOR_TESOROS = "#575A5C";
export const COLOR_MAESTROS = "#BF8900";
export const COLOR_VIDA = "#7E0023";

/** Lo que va a la derecha de una fila. */
export type ParteVym =
  | { t: "texto"; texto: string }
  | { t: "par"; a: string; b: string }
  | { t: "oracion"; nombre: string };

export interface FilaVym {
  hora: string;
  titulo: string;
  negritaTitulo?: boolean;
  parte?: ParteVym;
}

export type BloqueVym =
  | { t: "filas"; filas: FilaVym[] }
  | { t: "seccion"; titulo: string; color: string; aux?: string };

export type SemanaVym =
  | { sinReunion: true; fecha: string; lectura: string; motivos: string[] }
  | {
      sinReunion: false;
      fecha: string;
      lectura: string;
      presidente: string;
      oracion: string;
      bloques: BloqueVym[];
    };

export interface ContextoVym {
  getNombre: (id: string | null | undefined) => string;
  horaInicio?: string;
  consejoMaestrosMins?: number;
  /** Día configurado de reunión entre semana (ej. "martes"). */
  diaEntreSemana?: string;
}

function limpiarTitulo(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s*\(\s*\d+\s*mins?\.?\s*\)\s*$/i, "").trim();
}

function sufijoMins(min: number): string {
  return `(${min} ${min === 1 ? "min." : "mins."})`;
}

function tituloConMins(
  titulo: string | null | undefined,
  duracion: number | null | undefined,
  fallbackMin: number,
  fallbackTitulo = ""
): string {
  const base = limpiarTitulo(titulo) || fallbackTitulo;
  const mins = duracion && duracion > 0 ? duracion : fallbackMin;
  return `${base} ${sufijoMins(mins)}`.trim();
}

function addMins(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const totalSec = h * 3600 + m * 60 + Math.round(mins * 60);
  const totalMinRounded = Math.round(totalSec / 60);
  const nh = Math.floor(totalMinRounded / 60) % 24;
  const nm = totalMinRounded % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function construirSemanaVym(programa: ProgramaVidaMinisterio, ctx: ContextoVym): SemanaVym {
  const { getNombre } = ctx;
  const horaInicio = ctx.horaInicio ?? "19:30";
  const consejoMaestrosMins = ctx.consejoMaestrosMins ?? 0;
  const offsetDia = (DIA_SEMANA_MAP[ctx.diaEntreSemana ?? "martes"] ?? 2) - 1;

  const fechaReunion = addDays(parseISO(programa.fecha_semana), offsetDia);
  const fecha = format(fechaReunion, "d 'de' MMMM", { locale: es }).toUpperCase();
  const lectura = (programa.lectura_semana || "").toUpperCase();

  if ((programa as any).sin_reunion) {
    const motivos = [(programa as any).sin_reunion_motivo || "", (programa as any).sin_reunion_motivo_2 || ""].filter(Boolean);
    return { sinReunion: true, fecha, lectura, motivos };
  }

  const t_ = programa.tesoros || ({} as any);
  const eb = programa.estudio_biblico || ({} as any);

  const dCancionInicial = t_.cantico_inicial_duracion || 5;
  const dPalabrasIntro = t_.palabras_intro_duracion || 1;
  const dTesoros = t_.duracion || 10;
  const dPerlas = t_.perlas_duracion || 10;
  const dLectura = programa.lectura_biblica?.duracion || 4;

  let t = horaInicio;
  const tCancionInicial = t; t = addMins(t, dCancionInicial);
  const tPalabras = t; t = addMins(t, dPalabrasIntro);

  const tT1 = t; t = addMins(t, dTesoros);
  const tT2 = t; t = addMins(t, dPerlas);
  const tT3 = t; t = addMins(t, dLectura);

  const maestros = programa.maestros || [];
  const maestroTimes: string[] = [];
  const defaultDurs = maestros.length === 4 ? [1, 3, 3, 5] : maestros.length === 3 ? [3, 3, 5] : Array(maestros.length).fill(4);
  const maestroDurs = maestros.map((m, i) => (m.duracion && m.duracion > 0 ? m.duracion : (defaultDurs[i] ?? 4)));
  const consejoSec = Math.round((consejoMaestrosMins || 0) * 60);
  const [hM, mM] = t.split(":").map(Number);
  let acumSec = hM * 3600 + mM * 60;
  maestros.forEach((_, i) => {
    const minR = Math.round(acumSec / 60);
    maestroTimes.push(`${String(Math.floor(minR / 60) % 24).padStart(2, "0")}:${String(minR % 60).padStart(2, "0")}`);
    acumSec += maestroDurs[i] * 60 + consejoSec;
  });
  const minFinal = Math.round(acumSec / 60);
  t = `${String(Math.floor(minFinal / 60) % 24).padStart(2, "0")}:${String(minFinal % 60).padStart(2, "0")}`;

  const dCancionInter = t_.cantico_intermedio_duracion || 5;
  const tCancionInter = t; t = addMins(t, dCancionInter);

  const vidaPartes = programa.vida_cristiana || [];
  const vidaTimes: string[] = [];
  let vidaDursDefault: number[];
  if (vidaPartes.length === 2) vidaDursDefault = [10, 5];
  else if (vidaPartes.length === 1) vidaDursDefault = [15];
  else if (vidaPartes.length === 3) vidaDursDefault = [10, 5, 5];
  else vidaDursDefault = Array(vidaPartes.length).fill(5);
  const vidaDurs = vidaPartes.map((v, i) => (v.duracion && v.duracion > 0 ? v.duracion : (vidaDursDefault[i] ?? 5)));
  vidaPartes.forEach((_, i) => {
    vidaTimes.push(t);
    t = addMins(t, vidaDurs[i]);
  });

  const dEstudio = eb.duracion || 30;
  const dConclusion = eb.palabras_conclusion_duracion || 3;
  const esVisita = !!programa.estudio_biblico?.visita_superintendente;
  let tEstudio = "", tConclusion = "", tCancionFinal = "";
  if (esVisita) {
    // Orden: palabras de conclusión -> discurso superintendente -> cántico final
    tConclusion = t; t = addMins(t, dConclusion);
    tEstudio = t; t = addMins(t, dEstudio);
    tCancionFinal = t;
  } else {
    tEstudio = t; t = addMins(t, dEstudio);
    tConclusion = t; t = addMins(t, dConclusion);
    tCancionFinal = t;
  }

  const numStartMaestros = 4;
  const numStartVida = numStartMaestros + maestros.length;
  const numEstudio = numStartVida + vidaPartes.length;

  const bloques: BloqueVym[] = [];

  bloques.push({
    t: "filas",
    filas: [
      { hora: tCancionInicial, titulo: `• Canción ${programa.cantico_inicial ?? "—"}` },
      { hora: tPalabras, titulo: `• Palabras de introducción ${sufijoMins(dPalabrasIntro)}` },
    ],
  });

  bloques.push({ t: "seccion", titulo: "TESOROS DE LA BIBLIA", color: COLOR_TESOROS });
  bloques.push({
    t: "filas",
    filas: [
      {
        hora: tT1,
        titulo: `1. ${tituloConMins(programa.tesoros?.titulo, dTesoros, dTesoros, "Discurso Tesoros")}`,
        parte: { t: "texto", texto: getNombre(programa.tesoros?.participante_id) },
      },
      {
        hora: tT2,
        titulo: `2. Busquemos perlas escondidas ${sufijoMins(dPerlas)}`,
        parte: { t: "texto", texto: getNombre(programa.perlas_id) },
      },
      {
        hora: tT3,
        titulo: `3. Lectura de la Biblia${programa.lectura_biblica?.cita ? ` (${programa.lectura_biblica.cita})` : ""} ${sufijoMins(dLectura)}`,
        parte: { t: "texto", texto: getNombre(programa.lectura_biblica?.participante_id) },
      },
    ],
  });

  if (maestros.length > 0) {
    bloques.push({ t: "seccion", titulo: "SEAMOS MEJORES MAESTROS", color: COLOR_MAESTROS, aux: "Auditorio principal" });
    bloques.push({
      t: "filas",
      filas: maestros.map((m, idx) => {
        const esDiscurso = m.tipo === "discurso";
        // "¿Qué diría?" (analisis_con_auditorio) también es de una sola persona.
        const esIndividual = esDiscurso || m.tipo === "analisis_con_auditorio";
        const titular = getNombre(m.titular_id);
        return {
          hora: maestroTimes[idx],
          titulo: `${numStartMaestros + idx}. ${tituloConMins(m.titulo, m.duracion, defaultDurs[idx] ?? 4, esDiscurso ? "Discurso" : "Demostración")}`,
          parte: esIndividual
            ? { t: "texto", texto: titular }
            : { t: "par", a: titular, b: getNombre(m.ayudante_id) },
        } as FilaVym;
      }),
    });
  }

  bloques.push({ t: "seccion", titulo: "NUESTRA VIDA CRISTIANA", color: COLOR_VIDA });
  const filasVida: FilaVym[] = [{ hora: tCancionInter, titulo: `• Canción ${programa.cantico_intermedio ?? "—"}` }];
  vidaPartes.forEach((v, idx) => {
    filasVida.push({
      hora: vidaTimes[idx],
      titulo: `${numStartVida + idx}. ${tituloConMins(v.titulo, v.duracion, vidaDursDefault[idx] ?? 5, "Parte de la Vida Cristiana")}`,
      parte: { t: "texto", texto: getNombre(v.participante_id) },
    });
  });
  if (esVisita) {
    filasVida.push({
      hora: tConclusion,
      titulo: `• Palabras de conclusión ${sufijoMins(dConclusion)}`,
      parte: programa.presidente_id ? { t: "texto", texto: getNombre(programa.presidente_id) } : undefined,
    });
    filasVida.push({ hora: "", titulo: "Discurso Superintendente de Circuito", negritaTitulo: true });
    filasVida.push({
      hora: tEstudio,
      titulo: tituloConMins(programa.estudio_biblico?.titulo_discurso, dEstudio, dEstudio, "Discurso del superintendente"),
      parte: { t: "texto", texto: getNombre(programa.estudio_biblico?.conductor_id) },
    });
  } else {
    filasVida.push({
      hora: tEstudio,
      titulo: `${numEstudio}. ${tituloConMins(programa.estudio_biblico?.titulo, dEstudio, dEstudio, "Estudio bíblico de la congregación")}`,
      parte: {
        t: "par",
        a: getNombre(programa.estudio_biblico?.conductor_id),
        b: getNombre(programa.estudio_biblico?.lector_id),
      },
    });
    filasVida.push({ hora: tConclusion, titulo: `• Palabras de conclusión ${sufijoMins(dConclusion)}` });
  }
  filasVida.push({
    hora: tCancionFinal,
    titulo: `• Canción ${programa.cantico_final ?? "—"}`,
    parte: programa.oracion_final_id ? { t: "oracion", nombre: getNombre(programa.oracion_final_id) } : undefined,
  });
  bloques.push({ t: "filas", filas: filasVida });

  return {
    sinReunion: false,
    fecha,
    lectura,
    presidente: getNombre(programa.presidente_id),
    oracion: getNombre(programa.oracion_inicial_id),
    bloques,
  };
}
