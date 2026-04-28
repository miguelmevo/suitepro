import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToTopButtonProps {
  /** Element that actually scrolls. If omitted, listens to window scroll. */
  targetRef?: React.RefObject<HTMLElement>;
  threshold?: number;
}

export function ScrollToTopButton({ targetRef, threshold = 300 }: ScrollToTopButtonProps) {
  const [visible, setVisible] = useState(false);
  const tickingRef = useRef(false);

  useEffect(() => {
    const el = targetRef?.current ?? null;
    const getScroll = () =>
      el ? el.scrollTop : window.scrollY || document.documentElement.scrollTop;

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        setVisible(getScroll() > threshold);
        tickingRef.current = false;
      });
    };

    const target: EventTarget = el ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, [targetRef, threshold]);

  const handleClick = () => {
    const el = targetRef?.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    } else {
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
