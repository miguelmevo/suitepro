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
 * Aplica, mientras dura la captura, las reglas `@media print` del propio
 * bloque (sus <style> internos). Así el PDF sale con el mismo diseño que la
 * impresión: columnas de ancho fijo, texto que baja de línea, etc. Se ignoran
 * las reglas de página (html, body, *) para no afectar al resto de la app.
 * Devuelve una función que deshace el cambio.
 */
export function aplicarEstilosDeImpresion(elemento: HTMLElement): () => void {
  let css = "";
  elemento.querySelectorAll("style").forEach((st) => {
    const hoja = st.sheet;
    if (!hoja) return;
    for (const regla of Array.from(hoja.cssRules)) {
      if (regla instanceof CSSMediaRule && regla.media.mediaText.includes("print")) {
        for (const r of Array.from(regla.cssRules)) {
          if (r instanceof CSSStyleRule && !/^\s*(html|body|\*)/.test(r.selectorText)) {
            // ":not(#id)" sube la prioridad de la regla: así gana también a las reglas de
            // pantalla de otras copias del mismo componente que estén más abajo en la página.
            const selector = r.selectorText.split(",").map((sel) => `${sel.trim()}:not(#pdf-impresion)`).join(", ");
            css += `${selector} { ${r.style.cssText} }\n`;
          }
        }
      }
    }
  });
  if (!css) return () => {};
  const estilo = document.createElement("style");
  estilo.setAttribute("data-pdf-impresion", "");
  estilo.textContent = css;
  // Al final del propio bloque: así viene después de sus reglas de pantalla y las pisa.
  elemento.appendChild(estilo);
  return () => estilo.remove();
}

/**
 * Si una palabra no cabe en el ancho de su celda, se achica la letra de esa
 * celda hasta que quepa: el texto puede bajar de línea, pero una palabra nunca
 * se corta ni se sale de la celda.
 */
export function ajustarPalabrasLargas(elemento: HTMLElement) {
  elemento.querySelectorAll<HTMLElement>("td, th").forEach((celda) => {
    if (celda.scrollWidth <= celda.clientWidth + 0.5) return;
    let px = parseFloat(getComputedStyle(celda).fontSize) || 8;
    while (celda.scrollWidth > celda.clientWidth + 0.5 && px > 4) {
      px -= 0.3;
      celda.style.fontSize = `${px}px`;
    }
  });
}

const ANCHO_MAXIMO_PX = 1300;

/**
 * Ensancha el diseño (las columnas crecen en proporción) hasta que su forma se
 * parezca a la de la hoja. Un programa de mes largo es muy alto para su ancho:
 * al reducirlo para que quepa, sobraría espacio a los lados. Con más ancho el
 * texto baja de línea menos, las filas se achatan y la hoja se llena.
 */
function ajustarAnchoALaHoja(elemento: HTMLElement, proporcionHoja: number): number {
  const alturaCon = (w: number) => {
    elemento.style.width = `${w}px`;
    elemento.style.maxWidth = `${w}px`;
    return elemento.scrollHeight;
  };
  const base = Math.ceil(elemento.offsetWidth);
  if (alturaCon(base) / base <= proporcionHoja) return base;
  if (alturaCon(ANCHO_MAXIMO_PX) / ANCHO_MAXIMO_PX > proporcionHoja) return ANCHO_MAXIMO_PX;
  let bajo = base;
  let alto = ANCHO_MAXIMO_PX;
  for (let i = 0; i < 14; i++) {
    const medio = (bajo + alto) / 2;
    if (alturaCon(medio) / medio <= proporcionHoja) alto = medio;
    else bajo = medio;
  }
  alturaCon(alto);
  return alto;
}

/** Una captura "en blanco" o "toda negra" indica que el navegador no pudo dibujarla. */
function capturaValida(canvas: HTMLCanvasElement): boolean {
  try {
    const ancho = 60;
    const alto = Math.max(1, Math.round((ancho * canvas.height) / canvas.width));
    const chico = document.createElement("canvas");
    chico.width = ancho;
    chico.height = alto;
    const ctx = chico.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(canvas, 0, 0, ancho, alto);
    const datos = ctx.getImageData(0, 0, ancho, alto).data; // falla si el lienzo está "contaminado"
    let conTinta = 0;
    let negros = 0;
    for (let i = 0; i < datos.length; i += 4) {
      const suma = datos[i] + datos[i + 1] + datos[i + 2];
      if (suma < 720) conTinta++;
      if (suma < 60) negros++;
    }
    const total = ancho * alto;
    return conTinta / total > 0.02 && negros / total < 0.6;
  } catch {
    return false;
  }
}

async function fotografiar(elemento: HTMLElement, ancho: number, alto: number, foreignObjectRendering: boolean) {
  return html2canvas(elemento, {
    scale: 3,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    foreignObjectRendering,
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
}

/**
 * Convierte un bloque de la pantalla en un PDF carta y lo descarga.
 *  - Aplica el diseño de impresión y lo ensancha hasta llenar la hoja.
 *  - Usa el propio motor del navegador para dibujar el texto (queda centrado
 *    en las celdas); si el navegador no puede, usa el método alternativo.
 *  - El contenido entra completo en una sola hoja.
 * Funciona en Chrome, Edge, Firefox y Safari, en Windows y Mac.
 */
export async function descargarPdfDeElemento(elemento: HTMLElement, { nombre, orientation = "portrait", margen = 5 }: Opciones): Promise<string> {
  const paginaW = orientation === "portrait" ? 215.9 : 279.4;
  const paginaH = orientation === "portrait" ? 279.4 : 215.9;
  const anchoDisponible = paginaW - margen * 2;
  const altoDisponible = paginaH - margen * 2;

  const anchoOriginal = elemento.style.width;
  const anchoMaxOriginal = elemento.style.maxWidth;
  const margenOriginal = elemento.style.margin;
  // Pegada al borde izquierdo: sin centrado automático que desfase el recorte.
  elemento.style.margin = "0";
  const deshacerEstilos = aplicarEstilosDeImpresion(elemento);
  try {
    // Deja que el navegador reacomode el diseño con los estilos de impresión.
    await new Promise((r) => setTimeout(r, 80));
    ajustarAnchoALaHoja(elemento, altoDisponible / anchoDisponible);
    ajustarPalabrasLargas(elemento);

    // El contenido puede ser más ancho que su caja: se captura su tamaño completo.
    const ancho = Math.ceil(Math.max(elemento.scrollWidth, elemento.offsetWidth));
    const alto = Math.ceil(Math.max(elemento.scrollHeight, elemento.offsetHeight));

    let canvas: HTMLCanvasElement | null = null;
    try {
      const intento = await fotografiar(elemento, ancho, alto, true);
      if (capturaValida(intento)) canvas = intento;
    } catch (e) {
      console.warn("Captura nativa no disponible, se usa el método alternativo", e);
    }
    if (!canvas) canvas = await fotografiar(elemento, ancho, alto, false);

    const pdf = new jsPDF({ orientation, unit: "mm", format: "letter" });
    // Cabe en el ancho; si además es más alto que la hoja, se reduce en proporción.
    const factor = Math.min(anchoDisponible / canvas.width, altoDisponible / canvas.height);
    const w = canvas.width * factor;
    const h = canvas.height * factor;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", margen + (anchoDisponible - w) / 2, margen, w, h);

    const archivo = `${nombre}.pdf`;
    descargarBlob(pdf.output("blob"), archivo);
    return archivo;
  } finally {
    elemento.style.width = anchoOriginal;
    elemento.style.maxWidth = anchoMaxOriginal;
    elemento.style.margin = margenOriginal;
    deshacerEstilos();
  }
}
