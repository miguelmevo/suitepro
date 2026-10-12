/**
 * Imprime un PDF ya generado (el mismo archivo que se descarga), para que lo impreso y lo
 * descargado sean idénticos.
 *  - Chrome, Edge, Firefox: se carga en un marco oculto y se abre el cuadro de impresión.
 *  - Safari: no imprime de forma fiable un PDF desde un marco oculto, así que se abre en una
 *    pestaña con su visor de PDF, desde donde se imprime (⌘P).
 */
export function imprimirPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const esSafari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
  if (esSafari) {
    const ventana = window.open(url, "_blank");
    if (!ventana) window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return;
  }
  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  marco.src = url;
  const limpiar = () =>
    setTimeout(() => {
      marco.remove();
      URL.revokeObjectURL(url);
    }, 60 * 1000);
  marco.onload = () => {
    try {
      marco.contentWindow?.focus();
      marco.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    limpiar();
  };
  document.body.appendChild(marco);
}
