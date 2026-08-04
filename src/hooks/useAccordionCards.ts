import { useCallback, useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Coordina el abrir/cerrar de un grupo de tarjetas colapsables.
 * En desktop cada tarjeta se abre/cierra de forma independiente (pueden
 * quedar varias abiertas a la vez). En móvil/tablet se comporta como
 * acordeón: abrir una cierra las demás.
 */
export function useAccordionCards(defaultOpenDesktopIds: string[] = []) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  );
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) return new Set();
    return new Set(defaultOpenDesktopIds);
  });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        if (isMobile) {
          return prev.has(id) ? new Set<string>() : new Set([id]);
        }
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [isMobile]
  );

  const isOpen = useCallback((id: string) => openIds.has(id), [openIds]);

  return { isOpen, toggle };
}
