import { useCallback, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Coordina un grupo de tarjetas colapsables como acordeón: solo una puede
 * estar abierta a la vez (abrir una cierra la anterior), tanto en desktop
 * como en móvil/tablet. Por defecto arranca abierta la tarjeta indicada
 * en desktop, y todas cerradas en móvil/tablet.
 */
export function useAccordionCards(defaultOpenIdDesktop: string | null = null) {
  const [openId, setOpenId] = useState<string | null>(() => {
    if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) return null;
    return defaultOpenIdDesktop;
  });

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const isOpen = useCallback((id: string) => openId === id, [openId]);

  return { isOpen, toggle };
}
