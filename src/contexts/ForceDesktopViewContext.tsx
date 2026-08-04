import { createContext, useContext, useEffect, useState, ReactNode } from "react";

const STORAGE_KEY = "suitepro-forzar-desktop";
const DESKTOP_VIEWPORT_CONTENT = "width=1280";
const DEFAULT_VIEWPORT_CONTENT = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

interface ForceDesktopViewContextValue {
  forced: boolean;
  toggle: () => void;
}

const ForceDesktopViewContext = createContext<ForceDesktopViewContextValue>({
  forced: false,
  toggle: () => {},
});

/**
 * Permite "forzar" la vista de escritorio desde un dispositivo móvil,
 * ampliando el viewport (igual que "Solicitar sitio de escritorio" en un
 * navegador) para que las clases responsivas (md:/lg:) y los hooks
 * useIsMobile/useIsTablet se comporten como en desktop.
 */
export function ForceDesktopViewProvider({ children }: { children: ReactNode }) {
  const [forced, setForced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute("content", forced ? DESKTOP_VIEWPORT_CONTENT : DEFAULT_VIEWPORT_CONTENT);
  }, [forced]);

  const toggle = () => {
    setForced((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <ForceDesktopViewContext.Provider value={{ forced, toggle }}>
      {children}
    </ForceDesktopViewContext.Provider>
  );
}

export function useForceDesktopView() {
  return useContext(ForceDesktopViewContext);
}
