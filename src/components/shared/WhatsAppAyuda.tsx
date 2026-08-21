import { cn } from "@/lib/utils";

// Número y mensaje de ayuda. Botón flotante, disponible en toda la app
// (públicas y logueadas).
const WHATSAPP_NUMERO = "56984792142";
const WHATSAPP_MENSAJE = "Hola, necesito ayuda con el registro en suitepro.org";

interface WhatsAppAyudaProps {
  /** Levanta el botón para no taparse con el BottomNav móvil (~64px + safe-area). */
  mobileOffset?: boolean;
  /** Levanta el botón para no superponerse con ScrollToTopButton (bottom-6). */
  stackAboveScrollTop?: boolean;
}

export function WhatsAppAyuda({ mobileOffset = false, stackAboveScrollTop = false }: WhatsAppAyudaProps = {}) {
  const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MENSAJE)}`;

  const bottom = mobileOffset
    ? "calc(4rem + env(safe-area-inset-bottom) + 4.5rem)"
    : stackAboveScrollTop
      ? "5.5rem"
      : undefined;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ayuda por WhatsApp"
      title="¿Necesitas ayuda? Escríbenos por WhatsApp"
      style={bottom ? { bottom } : undefined}
      className={cn(
        "fixed right-4 z-50 flex flex-col items-center gap-1 transition-transform hover:scale-105 sm:right-5 sm:gap-1.5",
        !bottom && "bottom-4 sm:bottom-5",
      )}
    >
      <span className="rounded-full bg-[#25D366] px-2 py-0.5 text-[10px] font-semibold text-white shadow sm:px-2.5 sm:py-1 sm:text-xs">
        ¡Ayuda!
      </span>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:shadow-xl sm:h-14 sm:w-14">
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-7 sm:w-7" fill="currentColor" aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.04-.38-1.99-1.22-.73-.66-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01a.92.92 0 0 0-.67.31c-.23.25-.87.85-.87 2.08s.89 2.42 1.01 2.58c.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29Z" />
        </svg>
      </span>
    </a>
  );
}
