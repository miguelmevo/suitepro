import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";

interface Opciones {
  /** Nombre del archivo, sin la extensión .pdf */
  nombre: string;
  orientation?: "portrait" | "landscape";
  /** Margen en mm por cada lado. */
  margen?: number;
}

/** "aaaa.mm.dd_Tipo_Periodo_Congregacion" sin caracteres que los sistemas de archivos no admiten. */
export function nombreArchivoPdf(tipo: string, ...partes: string[]): string {
  const limpio = (t: string) =>
    t
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_");
  return [format(new Date(), "yyyy.MM.dd"), limpio(tipo), ...partes.filter(Boolean).map(limpio)].join("_");
}

function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Convierte un bloque de la pantalla en un PDF carta (la misma captura con la
 * que se publica el programa) y lo descarga. Si el contenido es más alto que la
 * hoja, se reduce para que quepa completo. Funciona igual en Chrome, Edge,
 * Firefox y Safari, en Windows y Mac.
 */
export async function descargarPdfDeElemento(elemento: HTMLElement, { nombre, orientation = "portrait", margen = 5 }: Opciones): Promise<string> {
  // El contenido puede ser más ancho que su caja (tablas con scroll horizontal):
  // se captura su tamaño completo, no solo la parte visible.
  const ancho = Math.ceil(Math.max(elemento.scrollWidth, elemento.offsetWidth));
  const alto = Math.ceil(Math.max(elemento.scrollHeight, elemento.offsetHeight));
  const canvas = await html2canvas(elemento, {
    scale: 3,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: ancho,
    height: alto,
    windowWidth: ancho,
    windowHeight: alto,
    onclone: (_doc, clon) => {
      // Sin recortes ni scroll en la copia que se fotografía.
      let nodo: HTMLElement | null = clon;
      while (nodo && nodo !== _doc.body) {
        nodo.style.overflow = "visible";
        nodo.style.maxWidth = "none";
        nodo.style.width = `${ancho}px`;
        nodo = nodo.parentElement;
      }
    },
  });

  const pdf = new jsPDF({ orientation, unit: "mm", format: "letter" });
  const paginaW = orientation === "portrait" ? 215.9 : 279.4;
  const paginaH = orientation === "portrait" ? 279.4 : 215.9;
  const anchoDisponible = paginaW - margen * 2;
  const altoDisponible = paginaH - margen * 2;

  // Cabe en el ancho; si además es más alto que la hoja, se reduce en proporción.
  const factor = Math.min(anchoDisponible / canvas.width, altoDisponible / canvas.height);
  const w = canvas.width * factor;
  const h = canvas.height * factor;

  pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", margen + (anchoDisponible - w) / 2, margen, w, h);

  const archivo = `${nombre}.pdf`;
  descargarBlob(pdf.output("blob"), archivo);
  return archivo;
}
