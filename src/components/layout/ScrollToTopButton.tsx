import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToTopButtonProps {
  /** Optional element that scrolls. Component also listens to window scroll as fallback. */
  targetRef?: React.RefObject<HTMLElement>;
  threshold?: number;
}

export function ScrollToTopButton({ targetRef, threshold = 300 }: ScrollToTopButtonProps) {
  const [visible, setVisible] = useState(false);
  const tickingRef = useRef(false);

  useEffect(() => {
    const getMaxScroll = () => {
      const winScroll = window.scrollY || document.documentElement.scrollTop || 0;
      const elScroll = targetRef?.current?.scrollTop ?? 0;
      return Math.max(winScroll, elScroll);
    };

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        setVisible(getMaxScroll() > threshold);
        tickingRef.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const el = targetRef?.current;
    el?.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      el?.removeEventListener("scroll", onScroll);
    };
  }, [targetRef, threshold]);

  const handleClick = () => {
    const el = targetRef?.current;
    if (el && el.scrollTop > 0) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
    if ((window.scrollY || 0) > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Ir arriba"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg",
        "flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-xl",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
