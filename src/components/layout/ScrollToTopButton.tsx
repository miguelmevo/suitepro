import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botón flotante global para volver al inicio del contenedor scrollable.
 * Busca el elemento <main> o el primer descendiente con overflow-auto.
 */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLElement | Window | null>(null);

  useEffect(() => {
    // Detectar el contenedor scrollable real
    const findScrollContainer = (): HTMLElement | Window => {
      const main = document.querySelector("main");
      if (main) {
        // En desktop, el scroll lo tiene el div interno con overflow-auto
        const inner = main.querySelector<HTMLElement>(".overflow-auto");
        if (inner && inner.scrollHeight > inner.clientHeight) return inner;
        // En mobile, el propio main tiene overflow-auto
        if (main.classList.contains("overflow-auto")) return main;
      }
      return window;
    };

    const el = findScrollContainer();
    setScrollEl(el);

    const handleScroll = () => {
      const top =
        el === window
          ? window.scrollY
          : (el as HTMLElement).scrollTop;
      setVisible(top > 300);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleClick = () => {
    if (!scrollEl) return;
    if (scrollEl === window) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      (scrollEl as HTMLElement).scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      size="icon"
      aria-label="Ir al inicio"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full shadow-lg transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
