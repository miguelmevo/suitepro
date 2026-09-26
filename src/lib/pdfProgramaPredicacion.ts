import jsPDF from "jspdf";
import { getColorTheme } from "@/lib/congregation-colors";
import type { EntradaFormateada, FilaPrograma } from "@/lib/programaPredicacionFilas";

/**
 * PDF del programa de Predicación DIBUJADO con texto y líneas reales (jsPDF), a
 * partir de las mismas filas que usa la impresión. No depende de cómo cada
 * navegador acomoda una tabla en pantalla: sale igual en Safari, Chrome, Edge y
 * Firefox. Ver docs/pdf-programa-predicacion.md (y cómo volver al método anterior).
 *
 * Diseño (hoja carta vertical):
 *  - Título, cabecera de dos filas (FECHA · HORARIO MAÑANA · HORARIO TARDE) y una
 *    "manzana" por día: fecha con rowSpan, salidas de mañana (5 columnas) y de tarde
 *    (4 columnas), mensajes (reunión, visita, etc.) en gris, filas alternas por día.
 *  - Cada texto vive dentro de su celda: baja de línea entre palabras, y si una
 *    palabra no cabe se achica la letra; nunca se corta una palabra ni se sale de
 *    su celda.
 *  - El tamaño de letra y el aire de las filas se ajustan solos para llenar la hoja.
 */

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGEN = 6;
const TABLA_W = PAGE_W - MARGEN * 2;
const MM_POR_PT = 25.4 / 72;
const INTERLINEADO = 1.16;

// Ancho de columnas en % (suman 100): fecha | mañana: hora, grupos, punto, terr., capitán | tarde: hora, dirección, terr., capitán
const PCT = [7, 5, 7, 21, 7, 10, 5, 21, 7, 10];
const COL_X: number[] = [];
const COL_W: number[] = PCT.map((p) => (TABLA_W * p) / 100);
COL_W.reduce((x, w, i) => {
  COL_X[i] = MARGEN + x;
  return x + w;
}, 0);
const X_TARDE = COL_X[6];

const TAM_TEXTO = 7.4;
const TAM_DIRECCION = 6.6;
const TAM_DIA = 6.8;
const TAM_NUM = 7.6;
const TAM_MENSAJE = 7.4;
const K_MAX = 1.25;
const K_MIN = 0.5;

type RGB = [number, number, number];

function aRGB(color: string | undefined, respaldo: RGB): RGB {
  if (!color) return respaldo;
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)) as RGB;
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (m) {
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    // Se mezcla con el blanco del papel.
    return [Number(m[1]), Number(m[2]), Number(m[3])].map((v) => Math.round(v * a + 255 * (1 - a))) as RGB;
  }
  return respaldo;
}

interface Segmento {
  texto: string;
  negrita?: boolean;
  color?: RGB;
}

/** Lo que va dentro de una celda. */
type Contenido =
  | { t: "texto"; texto: string; negrita?: boolean; color?: RGB }
  | { t: "punto"; nombre: string; direccion: string }
  | { t: "fecha"; dia: string; num: string }
  | { t: "grupos"; lineas: Segmento[][] }
  | { t: "mensaje"; texto: string };

interface Celda {
  col: number;
  colSpan: number;
  fila: number;
  filaSpan: number;
  contenido: Contenido | null;
  gris?: boolean;
}

interface Bloque {
  esAlt: boolean;
  adicional: { mensaje: string; color: string } | null;
  filas: number;
  celdas: Celda[];
}

// ---------------------------------------------------------------- estructura de cada día

function celdasDeEntradaManana(e: EntradaFormateada, fila: number, filaSpan: number): Celda[] {
  if (e.esPorGrupoIndividual) {
    const total = e.gruposLineas.length;
    const partir = (lineas: typeof e.gruposLineas): Segmento[] =>
      lineas.flatMap((l, i): Segmento[] => [
        ...(i > 0 ? [{ texto: " / ", color: [102, 102, 102] as RGB }] : []),
        { texto: `${l.grupos}:`, negrita: true },
        { texto: ` ${l.territorioNum}` },
      ]);
    const lineas: Segmento[][] = [partir(e.gruposLineas.slice(0, Math.min(6, total)))];
    if (total > 6) lineas.push(partir(e.gruposLineas.slice(6)));
    return [
      { col: 1, colSpan: 1, fila, filaSpan, contenido: { t: "texto", texto: e.hora } },
      { col: 2, colSpan: 3, fila, filaSpan, contenido: { t: "grupos", lineas } },
      { col: 5, colSpan: 1, fila, filaSpan, contenido: { t: "texto", texto: e.capitan } },
    ];
  }
  return [
    { col: 1, colSpan: 1, fila, filaSpan, contenido: { t: "texto", texto: e.hora } },
    { col: 2, colSpan: 1, fila, filaSpan, contenido: { t: "texto", texto: e.grupos } },
    { col: 3, colSpan: 1, fila, filaSpan, contenido: puntoDe(e) },
    { col: 4, colSpan: 1, fila, filaSpan, contenido: textoTerritorio(e.territorioNumero) },
    { col: 5, colSpan: 1, fila, filaSpan, contenido: { t: "texto", texto: e.capitan } },
  ];
}

function celdasDeEntradaTarde(e: EntradaFormateada, fila: number, filaSpan: number): Celda[] {
  return [
    { col: 6, colSpan: 1, fila, filaSpan, contenido: { t: "texto", texto: e.hora } },
    { col: 7, colSpan: 1, fila, filaSpan, contenido: puntoDe(e) },
    { col: 8, colSpan: 1, fila, filaSpan, contenido: textoTerritorio(e.territorioNumero) },
    { col: 9, colSpan: 1, fila, filaSpan, contenido: { t: "texto", texto: e.capitan } },
  ];
}

/** Los números de territorio van en negrita y con el color del tema; un texto como "Cartas presencial", normal. */
function textoTerritorio(texto: string): Contenido {
  return { t: "texto", texto, negrita: /^[\d\s,.\-y]+$/.test(texto) && /\d/.test(texto) };
}

/** Mismas reglas de la impresión: nombre del punto y, debajo, su dirección (o "ENLACE"/"CARTAS"/"VER MAPA"). */
function puntoDe(e: EntradaFormateada): Contenido {
  if (e.esZoom) {
    return { t: "punto", nombre: e.puntoEncuentro || "ZOOM", direccion: e.urlMaps ? e.direccion || "ENLACE" : e.direccion || "CARTAS" };
  }
  return { t: "punto", nombre: e.puntoEncuentro, direccion: e.direccion || e.urlMaps ? e.direccion || "VER MAPA" : "" };
}

/** Reparte `filas` entre `n` entradas: cada una ocupa varias filas y queda centrada. */
function repartir(filas: number, n: number): { inicio: number; span: number }[] {
  const base = Math.max(1, Math.floor(filas / n));
  return Array.from({ length: n }, (_, i) => ({ inicio: i * base, span: i === n - 1 ? filas - i * base : base }));
}

function armarBloque(filasDia: FilaPrograma[], esAlt: boolean): Bloque {
  const N = filasDia.length;
  const celdas: Celda[] = [];
  const primera = filasDia[0];

  celdas.push({ col: 0, colSpan: 1, fila: 0, filaSpan: N, contenido: { t: "fecha", dia: primera.diaSemana, num: primera.diaNumero } });

  if (N === 1 && primera.mensajeCompleto) {
    celdas.push({ col: 1, colSpan: 9, fila: 0, filaSpan: 1, contenido: { t: "mensaje", texto: primera.mensajeCompleto }, gris: true });
    return { esAlt, adicional: primera.mensajeAdicional ?? null, filas: N, celdas };
  }

  // Mañana
  const hayMensajeManana = filasDia.some((f) => f.mensajeManana);
  const entradasManana = filasDia.filter((f) => f.manana !== null).map((f) => f.manana as EntradaFormateada);
  const desbalanceManana = entradasManana.length > 0 && entradasManana.length < N && !hayMensajeManana;
  if (desbalanceManana) {
    repartir(N, entradasManana.length).forEach(({ inicio, span }, i) => celdas.push(...celdasDeEntradaManana(entradasManana[i], inicio, span)));
  } else {
    filasDia.forEach((f, i) => {
      if (f.mensajeManana) celdas.push({ col: 1, colSpan: 5, fila: i, filaSpan: 1, contenido: { t: "mensaje", texto: f.mensajeManana }, gris: true });
      else if (f.manana) celdas.push(...celdasDeEntradaManana(f.manana, i, 1));
    });
  }

  // Tarde
  const mensajeTarde = filasDia.find((f) => f.mensajeTarde)?.mensajeTarde ?? null;
  if (mensajeTarde) {
    celdas.push({ col: 6, colSpan: 4, fila: 0, filaSpan: N, contenido: { t: "mensaje", texto: mensajeTarde }, gris: true });
  } else {
    const entradasTarde = filasDia.filter((f) => f.tarde !== null).map((f) => f.tarde as EntradaFormateada);
    const desbalanceTarde = entradasTarde.length > 0 && entradasTarde.length < N;
    if (desbalanceTarde) {
      repartir(N, entradasTarde.length).forEach(({ inicio, span }, i) => celdas.push(...celdasDeEntradaTarde(entradasTarde[i], inicio, span)));
    } else {
      filasDia.forEach((f, i) => {
        if (f.tarde) celdas.push(...celdasDeEntradaTarde(f.tarde, i, 1));
      });
    }
  }

  return { esAlt, adicional: primera.mensajeAdicional ?? null, filas: N, celdas };
}

// ---------------------------------------------------------------- medición y dibujo de textos

interface Medido {
  alto: number; // mm, sin el aire de arriba/abajo
  dibujar: (x: number, yCentro: number) => void; // x = centro horizontal de la celda; yCentro = centro vertical del bloque
}

function anchoSegmentos(doc: jsPDF, segs: Segmento[], tam: number): number {
  return segs.reduce((suma, s) => {
    doc.setFont("helvetica", s.negrita ? "bold" : "normal");
    doc.setFontSize(tam);
    return suma + doc.getTextWidth(s.texto);
  }, 0);
}

/** Achica la letra hasta que la palabra más larga entre en `ancho`; luego parte el texto por palabras. */
function lineasQueCaben(doc: jsPDF, texto: string, ancho: number, tam: number, negrita: boolean, minimo = 3.6): { lineas: string[]; tam: number } {
  doc.setFont("helvetica", negrita ? "bold" : "normal");
  const palabras = texto.split(/\s+/).filter(Boolean);
  let fs = tam;
  for (;;) {
    doc.setFontSize(fs);
    if (palabras.every((p) => doc.getTextWidth(p) <= ancho) || fs <= minimo) break;
    fs -= 0.2;
  }
  return { lineas: (doc.splitTextToSize(texto, ancho) as string[]) ?? [], tam: fs };
}

function medir(doc: jsPDF, c: Contenido, ancho: number, k: number, colores: { link: RGB }): Medido {
  const disp = ancho - 1.6; // aire a los lados
  const lh = (tam: number) => tam * MM_POR_PT * INTERLINEADO;

  if (c.t === "texto" || c.t === "mensaje") {
    const esMensaje = c.t === "mensaje";
    const texto = esMensaje ? c.texto.toUpperCase() : c.texto;
    const negrita = esMensaje ? true : !!c.negrita;
    const color = c.t === "texto" ? (c.negrita ? colores.link : undefined) : undefined;
    const r = lineasQueCaben(doc, texto, disp, (esMensaje ? TAM_MENSAJE : TAM_TEXTO) * k, negrita);
    const h = lh(r.tam);
    return {
      alto: r.lineas.length * h,
      dibujar: (x, yc) => {
        doc.setFont("helvetica", negrita ? "bold" : "normal");
        doc.setFontSize(r.tam);
        if (color) doc.setTextColor(...color);
        else doc.setTextColor(0, 0, 0);
        const y0 = yc - (r.lineas.length * h) / 2;
        r.lineas.forEach((l, i) => doc.text(l, x, y0 + h * (i + 0.5), { align: "center", baseline: "middle" }));
        doc.setTextColor(0, 0, 0);
      },
    };
  }

  if (c.t === "punto") {
    const a = lineasQueCaben(doc, c.nombre, disp, TAM_TEXTO * k, false);
    const b = c.direccion ? lineasQueCaben(doc, c.direccion, disp, TAM_DIRECCION * k, false) : null;
    const ha = lh(a.tam);
    const hb = b ? lh(b.tam) : 0;
    const total = a.lineas.length * ha + (b ? b.lineas.length * hb : 0);
    return {
      alto: total,
      dibujar: (x, yc) => {
        let y = yc - total / 2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(a.tam);
        doc.setTextColor(0, 0, 0);
        a.lineas.forEach((l) => {
          doc.text(l, x, y + ha / 2, { align: "center", baseline: "middle" });
          y += ha;
        });
        if (b) {
          doc.setFontSize(b.tam);
          doc.setTextColor(...colores.link);
          b.lineas.forEach((l) => {
            doc.text(l, x, y + hb / 2, { align: "center", baseline: "middle" });
            y += hb;
          });
          doc.setTextColor(0, 0, 0);
        }
      },
    };
  }

  if (c.t === "fecha") {
    const dia = lineasQueCaben(doc, c.dia, disp, TAM_DIA * k, false);
    const num = TAM_NUM * k;
    const hd = lh(dia.tam);
    const hn = lh(num);
    const total = dia.lineas.length * hd + hn;
    return {
      alto: total,
      dibujar: (x, yc) => {
        let y = yc - total / 2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(dia.tam);
        doc.setTextColor(0, 0, 0);
        dia.lineas.forEach((l) => {
          doc.text(l, x, y + hd / 2, { align: "center", baseline: "middle" });
          y += hd;
        });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(num);
        doc.text(c.num, x, y + hn / 2, { align: "center", baseline: "middle" });
      },
    };
  }

  // grupos en línea (domingos): cada línea es una lista de segmentos con distinto estilo
  let tam = TAM_TEXTO * k;
  while (tam > 3.6 && c.lineas.some((l) => anchoSegmentos(doc, l, tam) > disp)) tam -= 0.2;
  const h = lh(tam);
  return {
    alto: c.lineas.length * h,
    dibujar: (x, yc) => {
      const y0 = yc - (c.lineas.length * h) / 2;
      c.lineas.forEach((segs, i) => {
        let cx = x - anchoSegmentos(doc, segs, tam) / 2;
        segs.forEach((s) => {
          doc.setFont("helvetica", s.negrita ? "bold" : "normal");
          doc.setFontSize(tam);
          doc.setTextColor(...(s.color ?? [0, 0, 0]));
          doc.text(s.texto, cx, y0 + h * (i + 0.5), { baseline: "middle" });
          cx += doc.getTextWidth(s.texto);
        });
      });
      doc.setTextColor(0, 0, 0);
    },
  };
}

// ---------------------------------------------------------------- disposición de un día

interface BloqueMedido {
  bloque: Bloque;
  alturas: number[]; // por sub-fila
  alturaBarra: number;
  medidos: { celda: Celda; medido: Medido | null }[];
  total: number;
}

function medirBloque(doc: jsPDF, b: Bloque, k: number, colores: { link: RGB }, estirar: number): BloqueMedido {
  const aire = 0.85 * k; // arriba y abajo
  const minFila = TAM_TEXTO * k * MM_POR_PT * INTERLINEADO + aire * 2;
  const alturas = Array(b.filas).fill(minFila) as number[];

  const medidos = b.celdas.map((celda) => {
    if (!celda.contenido) return { celda, medido: null };
    let ancho = 0;
    for (let i = 0; i < celda.colSpan; i++) ancho += COL_W[celda.col + i];
    return { celda, medido: medir(doc, celda.contenido, ancho, k, colores) };
  });

  // Primero las celdas de una sola fila, luego las que abarcan varias (de menor a mayor).
  [...medidos]
    .sort((a, b2) => a.celda.filaSpan - b2.celda.filaSpan)
    .forEach(({ celda, medido }) => {
      if (!medido) return;
      const necesita = medido.alto + aire * 2;
      const rango = alturas.slice(celda.fila, celda.fila + celda.filaSpan);
      const suma = rango.reduce((s, v) => s + v, 0);
      if (necesita > suma) {
        const extra = (necesita - suma) / celda.filaSpan;
        for (let i = celda.fila; i < celda.fila + celda.filaSpan; i++) alturas[i] += extra;
      }
    });

  for (let i = 0; i < alturas.length; i++) alturas[i] *= estirar;
  const alturaBarra = b.adicional ? TAM_MENSAJE * k * MM_POR_PT * INTERLINEADO + aire * 2 : 0;
  return { bloque: b, alturas, alturaBarra, medidos, total: alturas.reduce((s, v) => s + v, 0) + alturaBarra };
}

// ---------------------------------------------------------------- documento

export interface OpcionesPdfPrograma {
  filas: FilaPrograma[];
  fechas: string[];
  mesAnio: string;
  colorTema?: string;
}

const ALTO_TITULO = 10;
const ALTO_CABECERA_1 = 5.6;
const ALTO_CABECERA_2 = 6.2;

export function generarPdfProgramaPredicacion({ filas, fechas, mesAnio, colorTema = "blue" }: OpcionesPdfPrograma): jsPDF {
  const tema = getColorTheme(colorTema).pdf;
  const oscuro = aRGB(tema.headerDark, [26, 82, 118]);
  const claro = aRGB(tema.headerLight, [41, 128, 185]);
  const alterno = aRGB(tema.rowAlt, [235, 243, 249]);
  const link = aRGB(tema.link, claro);
  const titulo = aRGB(tema.title, oscuro);
  const gris: RGB = [234, 236, 238];

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  doc.setLineWidth(0.15);

  // Agrupar por día conservando el orden.
  const porFecha = new Map<string, FilaPrograma[]>();
  filas.forEach((f) => porFecha.set(f.fecha, [...(porFecha.get(f.fecha) ?? []), f]));
  const bloques = [...porFecha.entries()].map(([fecha, dia]) => armarBloque(dia, fechas.indexOf(fecha) % 2 === 1));

  const altoDisponible = PAGE_H - MARGEN * 2 - ALTO_TITULO - ALTO_CABECERA_1 - ALTO_CABECERA_2;

  // Mayor tamaño de letra con el que todo el mes cabe en una hoja; si no cabe ni con el mínimo, se reparte en varias.
  let k = K_MAX;
  let medidos = bloques.map((b) => medirBloque(doc, b, k, { link }, 1));
  while (medidos.reduce((s, m) => s + m.total, 0) > altoDisponible && k > K_MIN) {
    k = Math.round((k - 0.02) * 100) / 100;
    medidos = bloques.map((b) => medirBloque(doc, b, k, { link }, 1));
  }
  const totalSinEstirar = medidos.reduce((s, m) => s + m.total, 0);
  // Si sobra hoja, las filas ganan aire (hasta un 60 %) para aprovecharla.
  if (totalSinEstirar < altoDisponible) {
    const estirar = Math.min(1.6, altoDisponible / totalSinEstirar);
    medidos = bloques.map((b) => medirBloque(doc, b, k, { link }, estirar));
  }

  // Reparto en hojas (normalmente una).
  const paginas: BloqueMedido[][] = [[]];
  let usado = 0;
  medidos.forEach((m) => {
    if (usado + m.total > altoDisponible + 0.01 && paginas[paginas.length - 1].length > 0) {
      paginas.push([]);
      usado = 0;
    }
    paginas[paginas.length - 1].push(m);
    usado += m.total;
  });

  paginas.forEach((pagina, iPagina) => {
    if (iPagina > 0) doc.addPage();

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...titulo);
    doc.text(`PROGRAMA DE PREDICACIÓN - ${mesAnio.toUpperCase()}`, PAGE_W / 2, MARGEN + 6, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // Cabecera
    const y0 = MARGEN + ALTO_TITULO;
    const yH2 = y0 + ALTO_CABECERA_1;
    const xFin = MARGEN + TABLA_W;
    const rect = (x: number, y: number, w: number, h: number, c: RGB) => {
      doc.setFillColor(...c);
      doc.rect(x, y, w, h, "F");
    };
    const textoCab = (t: string, x: number, y: number, w: number, h: number, tam: number) => {
      doc.setFont("helvetica", "bold");
      const r = lineasQueCaben(doc, t, w - 1.2, tam, true);
      doc.setFontSize(r.tam);
      doc.setTextColor(255, 255, 255);
      const lh = r.tam * MM_POR_PT * 1.1;
      const yy = y + h / 2 - (r.lineas.length * lh) / 2;
      r.lineas.forEach((l, i) => doc.text(l, x + w / 2, yy + lh * (i + 0.5), { align: "center", baseline: "middle" }));
      doc.setTextColor(0, 0, 0);
    };
    rect(MARGEN, y0, COL_W[0], ALTO_CABECERA_1 + ALTO_CABECERA_2, oscuro);
    textoCab("FECHA", MARGEN, y0, COL_W[0], ALTO_CABECERA_1 + ALTO_CABECERA_2, 7.4);
    rect(COL_X[1], y0, X_TARDE - COL_X[1], ALTO_CABECERA_1, oscuro);
    textoCab("HORARIO MAÑANA", COL_X[1], y0, X_TARDE - COL_X[1], ALTO_CABECERA_1, 7.4);
    rect(X_TARDE, y0, xFin - X_TARDE, ALTO_CABECERA_1, oscuro);
    textoCab("HORARIO TARDE", X_TARDE, y0, xFin - X_TARDE, ALTO_CABECERA_1, 7.4);
    const nombres = ["HORA", "GRUPOS", "PUNTO ENCUENTRO", "TERR.", "CAPITÁN", "HORA", "DIRECCIÓN", "TERR.", "CAPITÁN"];
    nombres.forEach((n, i) => {
      rect(COL_X[i + 1], yH2, COL_W[i + 1], ALTO_CABECERA_2, claro);
      textoCab(n, COL_X[i + 1], yH2, COL_W[i + 1], ALTO_CABECERA_2, 6.8);
    });

    // Cuerpo
    let y = yH2 + ALTO_CABECERA_2;
    const separadores: [number, number][] = [[y0, y]];
    pagina.forEach((m) => {
      const { bloque } = m;
      // barra de mensaje adicional
      if (bloque.adicional) {
        rect(MARGEN, y, TABLA_W, m.alturaBarra, aRGB(bloque.adicional.color, oscuro));
        textoCab(bloque.adicional.mensaje.toUpperCase(), MARGEN, y, TABLA_W, m.alturaBarra, TAM_MENSAJE * k);
        y += m.alturaBarra;
      }
      const altoDia = m.alturas.reduce((s, v) => s + v, 0);
      if (bloque.esAlt) rect(MARGEN, y, TABLA_W, altoDia, alterno);
      // La línea mañana | tarde se dibuja por día y no cruza los mensajes que ocupan todo el ancho.
      if (!bloque.celdas.some((c) => c.colSpan === 9)) separadores.push([y, y + altoDia]);

      const yFila = (i: number) => y + m.alturas.slice(0, i).reduce((s, v) => s + v, 0);
      m.medidos.forEach(({ celda, medido }) => {
        if (!medido) return;
        const cx = COL_X[celda.col];
        let cw = 0;
        for (let i = 0; i < celda.colSpan; i++) cw += COL_W[celda.col + i];
        const cy = yFila(celda.fila);
        const ch = m.alturas.slice(celda.fila, celda.fila + celda.filaSpan).reduce((s, v) => s + v, 0);
        if (celda.gris) rect(cx, cy, cw, ch, gris);
        medido.dibujar(cx + cw / 2, cy + ch / 2);
      });
      y += altoDia;
    });

    // Marco de la tabla y separación mañana | tarde
    doc.setDrawColor(...oscuro);
    doc.setLineWidth(0.35);
    doc.line(MARGEN, y0, MARGEN, y);
    doc.line(xFin, y0, xFin, y);
    doc.line(MARGEN, y, xFin, y);
    doc.setLineWidth(0.2);
    separadores.forEach(([desde, hasta]) => doc.line(X_TARDE, desde, X_TARDE, hasta));
    doc.setDrawColor(0, 0, 0);
  });

  return doc;
}
