import jsPDF from "jspdf";
import { format } from "date-fns";
import { BLOCKS_PER_PAGE, ROWS_PER_PAGE, type FilaS13 } from "@/hooks/useDatosS13";

// Hoja carta vertical, en milímetros. El diseño replica el formulario S-13-S
// que se imprime desde la vista previa (misma cuadrícula: 2 líneas por territorio).
const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 12;
const TABLE_W = PAGE_W - MARGIN * 2;
const COL_NUM = TABLE_W * 0.07;
const COL_ULT = TABLE_W * 0.11;
const COL_BLOCK = (TABLE_W - COL_NUM - COL_ULT) / (BLOCKS_PER_PAGE * 2);
const HEAD_1 = 5;
const HEAD_2 = 8;
const ROW_H = 5.3;
const GRIS = 232;

interface Opciones {
  pages: FilaS13[][];
  congregacionNombre: string;
  periodoLabel: string;
}

/** Texto centrado en una celda, achicando la letra hasta que quepa en una línea. */
function textoEnCelda(doc: jsPDF, texto: string, x: number, y: number, w: number, h: number, size: number, bold = false) {
  if (!texto) return;
  doc.setFont("helvetica", bold ? "bold" : "normal");
  let fs = size;
  doc.setFontSize(fs);
  while (fs > 4.5 && doc.getTextWidth(texto) > w - 1.2) {
    fs -= 0.25;
    doc.setFontSize(fs);
  }
  doc.text(texto, x + w / 2, y + h / 2, { align: "center", baseline: "middle", maxWidth: w - 0.4 });
}

/**
 * Texto que se parte en varias líneas y queda centrado horizontal y
 * verticalmente en la celda. Si no cabe, se achica la letra: nunca desborda.
 */
function textoEnVariasLineas(doc: jsPDF, texto: string, x: number, y: number, w: number, h: number, size: number) {
  doc.setFont("helvetica", "bold");
  let fs = size;
  let lineas: string[] = [];
  let alto = 0;
  const mmPorPt = 25.4 / 72;
  for (;;) {
    doc.setFontSize(fs);
    lineas = doc.splitTextToSize(texto, w - 1.5) as string[];
    alto = lineas.length * fs * doc.getLineHeightFactor() * mmPorPt;
    if ((alto <= h - 1.2 && lineas.every((l) => doc.getTextWidth(l) <= w - 1)) || fs <= 4) break;
    fs -= 0.25;
  }
  doc.text(lineas, x + w / 2, y + (h - alto) / 2, { align: "center", baseline: "top" });
}

function celda(doc: jsPDF, x: number, y: number, w: number, h: number, relleno = false) {
  if (relleno) {
    doc.setFillColor(GRIS, GRIS, GRIS);
    doc.rect(x, y, w, h, "FD");
  } else {
    doc.rect(x, y, w, h, "S");
  }
}

export function generarPdfS13({ pages, congregacionNombre, periodoLabel }: Opciones): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  doc.setLineWidth(0.15);
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);

  pages.forEach((filas, pageIdx) => {
    if (pageIdx > 0) doc.addPage();

    // Título y subtítulo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("REGISTRO DE ASIGNACIÓN DE TERRITORIO", PAGE_W / 2, MARGIN + 4, { align: "center" });
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const pagina = pages.length > 1 ? `  ·  Página ${pageIdx + 1} de ${pages.length}` : "";
    doc.text(`Período: ${periodoLabel}  ·  Congregación: ${congregacionNombre}${pagina}`, PAGE_W / 2, MARGIN + 10, { align: "center" });

    const y0 = MARGIN + 14;

    // Encabezado (dos filas)
    celda(doc, MARGIN, y0, COL_NUM, HEAD_1 + HEAD_2, true);
    textoEnVariasLineas(doc, "Núm. de terr.", MARGIN, y0, COL_NUM, HEAD_1 + HEAD_2, 6.5);
    celda(doc, MARGIN + COL_NUM, y0, COL_ULT, HEAD_1 + HEAD_2, true);
    textoEnVariasLineas(doc, "Última fecha en que se completó*", MARGIN + COL_NUM, y0, COL_ULT, HEAD_1 + HEAD_2, 6.5);
    for (let b = 0; b < BLOCKS_PER_PAGE; b++) {
      const x = MARGIN + COL_NUM + COL_ULT + b * COL_BLOCK * 2;
      celda(doc, x, y0, COL_BLOCK * 2, HEAD_1, true);
      textoEnCelda(doc, "Asignado a", x, y0, COL_BLOCK * 2, HEAD_1, 7, true);
      celda(doc, x, y0 + HEAD_1, COL_BLOCK, HEAD_2, true);
      textoEnVariasLineas(doc, "Fecha en que se asignó", x, y0 + HEAD_1, COL_BLOCK, HEAD_2, 6);
      celda(doc, x + COL_BLOCK, y0 + HEAD_1, COL_BLOCK, HEAD_2, true);
      textoEnVariasLineas(doc, "Fecha en que se completó", x + COL_BLOCK, y0 + HEAD_1, COL_BLOCK, HEAD_2, 6);
    }

    // Cuerpo: siempre 20 territorios por hoja; los que faltan quedan en blanco
    let y = y0 + HEAD_1 + HEAD_2;
    for (let i = 0; i < ROWS_PER_PAGE; i++) {
      const fila = filas[i];
      // Número y última fecha ocupan las dos líneas del territorio
      celda(doc, MARGIN, y, COL_NUM, ROW_H * 2);
      celda(doc, MARGIN + COL_NUM, y, COL_ULT, ROW_H * 2);
      if (fila) {
        textoEnCelda(doc, fila.numero, MARGIN, y, COL_NUM, ROW_H * 2, 8, true);
        textoEnCelda(doc, fila.ultimaFecha, MARGIN + COL_NUM, y, COL_ULT, ROW_H * 2, 7.5);
      }
      for (let b = 0; b < BLOCKS_PER_PAGE; b++) {
        const x = MARGIN + COL_NUM + COL_ULT + b * COL_BLOCK * 2;
        const bloque = fila?.blocks[b];
        celda(doc, x, y, COL_BLOCK * 2, ROW_H);
        textoEnCelda(doc, bloque?.asignado ?? "", x, y, COL_BLOCK * 2, ROW_H, 7);
        celda(doc, x, y + ROW_H, COL_BLOCK, ROW_H);
        textoEnCelda(doc, bloque?.inicio ?? "", x, y + ROW_H, COL_BLOCK, ROW_H, 6.5);
        celda(doc, x + COL_BLOCK, y + ROW_H, COL_BLOCK, ROW_H);
        textoEnCelda(doc, bloque?.fin ?? "", x + COL_BLOCK, y + ROW_H, COL_BLOCK, ROW_H, 6.5);
      }
      y += ROW_H * 2;
    }

    // Nota y pie
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(50, 50, 50);
    const nota = doc.splitTextToSize(
      "* Última fecha en que el territorio se completó antes del período seleccionado (o, en páginas de continuación, la última fecha mostrada en la página anterior).",
      TABLE_W,
    ) as string[];
    doc.text(nota, MARGIN, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    doc.text("S-13-S", MARGIN, Math.min(y + 4 + nota.length * 3 + 2, PAGE_H - 8));
    doc.text(congregacionNombre, PAGE_W - MARGIN, Math.min(y + 4 + nota.length * 3 + 2, PAGE_H - 8), { align: "right" });
    doc.setTextColor(0, 0, 0);
  });

  return doc;
}

/** Nombre del archivo: aaaa.mm.dd_S13_nombre_de_la_congregacion.pdf */
export function nombreArchivoS13(congregacionNombre: string, fecha = new Date()): string {
  const limpio = (congregacionNombre || "congregacion")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
  return `${format(fecha, "yyyy.MM.dd")}_S13_${limpio}.pdf`;
}

/**
 * Descarga el PDF con un enlace temporal; funciona igual en Chrome, Edge,
 * Firefox y Safari (Windows y Mac).
 */
export function descargarPdfS13(opciones: Opciones): string {
  const doc = generarPdfS13(opciones);
  const nombre = nombreArchivoS13(opciones.congregacionNombre);
  const url = URL.createObjectURL(doc.output("blob"));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return nombre;
}
