import { useEffect } from "react";

/**
 * Preserva la posición de scroll del contenedor scrollable cuando se abren/cierran
 * Dialogs de Radix. Radix bloquea el scroll del body al abrir un Dialog modal,
 * lo que puede provocar que al cerrarlo el contenedor interno (overflow-auto)
 * pierda su posición. Este hook guarda el scrollTop al abrir y lo restaura al cerrar.
 *
 * Se monta una sola vez de forma global desde AppLayout.
 */
export function usePreserveScrollOnDialog() {
  useEffect(() => {
    const getScrollContainer = (): HTMLElement | null => {
      const main = document.querySelector("main");
      if (!main) return null;
      const inner = main.querySelector<HTMLElement>(".overflow-auto");
      if (inner) return inner;
      if (main.classList.contains("overflow-auto")) return main as HTMLElement;
      return null;
    };

    let savedScroll = 0;
    let restoreTimer: number | null = null;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // Detectar apertura del Dialog
        for (const node of Array.from(m.addedNodes)) {
          if (
            node instanceof HTMLElement &&
            node.getAttribute("role") === "dialog"
          ) {
            const container = getScrollContainer();
            if (container) savedScroll = container.scrollTop;
          }
        }
        // Detectar cierre del Dialog
        for (const node of Array.from(m.removedNodes)) {
          if (
            node instanceof HTMLElement &&
            node.getAttribute("role") === "dialog"
          ) {
            const container = getScrollContainer();
            if (container && savedScroll > 0) {
              // Restauramos en el siguiente frame para esperar el unlock de scroll
              if (restoreTimer) window.clearTimeout(restoreTimer);
              restoreTimer = window.setTimeout(() => {
                container.scrollTop = savedScroll;
              }, 0);
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (restoreTimer) window.clearTimeout(restoreTimer);
    };
  }, []);
}
