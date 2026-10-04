import html2canvas from "html2canvas";
import { descargarBlob } from "@/lib/pdfDesdeElemento";

export type ResultadoCompartir = "compartido" | "descargado" | "cancelado";

/**
 * Convierte un bloque de la pantalla en imagen PNG y la ofrece al menú de
 * compartir del teléfono (ahí se elige WhatsApp y el destinatario). Si el
 * dispositivo no puede compartir archivos, la descarga. Los elementos con
 * `data-html2canvas-ignore` (botones) no salen en la imagen.
 */
export async function compartirElementoComoImagen(
  elemento: HTMLElement,
  nombreArchivo: string,
  texto: string,
): Promise<ResultadoCompartir> {
  const canvas = await html2canvas(elemento, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen");

  const archivo = new File([blob], `${nombreArchivo}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombreArchivo, text: texto });
      return "compartido";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelado";
      // Cualquier otro fallo del menú de compartir: se cae a la descarga.
    }
  }
  descargarBlob(blob, `${nombreArchivo}.png`);
  return "descargado";
}
