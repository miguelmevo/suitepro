import { useCallback, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Coordina un grupo de tarjetas colapsables como acordeón: solo una puede
 * estar abierta a la vez (abrir una cierra la anterior), tanto en desktop
 * como en móvil/tablet. Por defecto arranca abierta la tarjeta indicada
 * en desktop, y todas cerradas en móvil/tablet — salvo que se pase
 * `openOnMobileToo`, en cuyo caso también arranca abierta en móvil.
 */
export function useAccordionCards(defaultOpenId: string | null = null, openOnMobileToo = false) {
  const [openId, setOpenId] = useState<string | null>(() => {
    if (!openOnMobileToo && typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) return null;
    return defaultOpenId;
  });

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const isOpen = useCallback((id: string) => openId === id, [openId]);

  return { isOpen, toggle };
}
