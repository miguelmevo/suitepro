import { Sparkles, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  mensaje?: string;
  submensaje?: string;
}

/**
 * Overlay full-screen que bloquea la interacción mientras un proceso de
 * generación automática está en curso. Diseñado para usarse en cualquier
 * página/modal que tenga un botón de "Auto-generar" / "Asignación automática".
 *
 * No se puede cerrar manualmente: desaparece cuando `open` vuelve a false.
 */
export function GeneracionAutomaticaOverlay({
  open,
  mensaje = "Generando con IA…",
  submensaje = "Esto puede tardar unos segundos. No cierres la ventana.",
}: Props) {
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={mensaje}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-sm cursor-wait"
      // Bloquear interacciones por debajo del overlay
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-8 py-6 shadow-2xl max-w-sm mx-4 text-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg">
            <Sparkles className="h-8 w-8 text-primary-foreground animate-pulse" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 font-semibold text-base text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{mensaje}</span>
          </div>
          <p className="text-xs text-muted-foreground">{submensaje}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
