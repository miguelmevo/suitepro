import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

const STORAGE_KEY = "suitepro-forzar-desktop";
const DESKTOP_VIEWPORT_CONTENT = "width=1280";
const DEFAULT_VIEWPORT_CONTENT = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

interface ViewportContextValue {
  forced: boolean;
  toggle: () => void;
  isMobile: boolean;
  isTablet: boolean;
}

const ViewportContext = createContext<ViewportContextValue>({
  forced: false,
  toggle: () => {},
  isMobile: false,
  isTablet: false,
});

/**
 * Fuente única de verdad para "¿estamos en móvil/tablet?" y para el
 * forzado de vista de escritorio (igual que "Solicitar sitio de
 * escritorio" del navegador). Antes cada componente (AppLayout, MobileNav,
 * BottomNav, etc.) medía el ancho por su cuenta con su propio listener,
 * lo que podía desincronizarse al cambiar el <meta viewport> — un
 * componente quedaba pensando que seguía en desktop y otro ya en móvil.
 * Centralizarlo acá garantiza que todos lean el mismo valor a la vez.
 */
export function ForceDesktopViewProvider({ children }: { children: ReactNode }) {
  const [forced, setForced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [rawWidth, setRawWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    const recompute = () => setRawWidth(window.innerWidth);
    recompute();
    window.addEventListener("resize", recompute);
    window.visualViewport?.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      window.visualViewport?.removeEventListener("resize", recompute);
    };
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute("content", forced ? DESKTOP_VIEWPORT_CONTENT : DEFAULT_VIEWPORT_CONTENT);
    // Safari en iOS no siempre dispara "resize" al cambiar el meta viewport:
    // forzamos una relectura para no quedar con un ancho obsoleto.
    const raf = requestAnimationFrame(() => setRawWidth(window.innerWidth));
    const timeout = setTimeout(() => setRawWidth(window.innerWidth), 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [forced]);

  const toggle = useCallback(() => {
    setForced((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const isMobile = !forced && rawWidth < MOBILE_BREAKPOINT;
  const isTablet = !forced && rawWidth >= MOBILE_BREAKPOINT && rawWidth < TABLET_BREAKPOINT;

  return (
    <ViewportContext.Provider value={{ forced, toggle, isMobile, isTablet }}>
      {children}
    </ViewportContext.Provider>
  );
}

export function useForceDesktopView() {
  const { forced, toggle } = useContext(ViewportContext);
  return { forced, toggle };
}

export function useViewport() {
  return useContext(ViewportContext);
}
