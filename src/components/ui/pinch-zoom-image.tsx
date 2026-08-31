import { useCallback, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;

interface Point {
  x: number;
  y: number;
}

/**
 * Imagen con zoom táctil (pellizcar para agrandar/achicar), arrastre para
 * desplazar cuando está ampliada, doble tap/doble clic para alternar zoom, y
 * rueda del mouse en escritorio. Pensado para el visor de mapa de territorio
 * en pantalla completa (PWA), sin depender de una librería externa.
 */
export function PinchZoomImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });
  const gesture = useRef<{
    startDist: number;
    startScale: number;
    startTranslate: Point;
    panStart: Point | null;
    lastTap: number;
  }>({ startDist: 0, startScale: 1, startTranslate: { x: 0, y: 0 }, panStart: null, lastTap: 0 });

  const reset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const clamp = useCallback((t: Point, s: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return t;
    const maxX = (rect.width * (s - 1)) / 2;
    const maxY = (rect.height * (s - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, t.x)),
      y: Math.min(maxY, Math.max(-maxY, t.y)),
    };
  }, []);

  const distancia = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      gesture.current.startDist = distancia(e.touches);
      gesture.current.startScale = scale;
      gesture.current.startTranslate = translate;
      gesture.current.panStart = null;
    } else if (e.touches.length === 1) {
      const ahora = Date.now();
      if (ahora - gesture.current.lastTap < DOUBLE_TAP_MS) {
        scale > 1 ? reset() : setScale(DOUBLE_TAP_ZOOM);
        gesture.current.lastTap = 0;
      } else {
        gesture.current.lastTap = ahora;
      }
      gesture.current.panStart = { x: e.touches[0].clientX - translate.x, y: e.touches[0].clientY - translate.y };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const ratio = distancia(e.touches) / gesture.current.startDist;
      const nuevaEscala = Math.min(MAX_SCALE, Math.max(MIN_SCALE, gesture.current.startScale * ratio));
      setScale(nuevaEscala);
      setTranslate(clamp(gesture.current.startTranslate, nuevaEscala));
    } else if (e.touches.length === 1 && scale > 1 && gesture.current.panStart) {
      e.preventDefault();
      setTranslate(
        clamp(
          { x: e.touches[0].clientX - gesture.current.panStart.x, y: e.touches[0].clientY - gesture.current.panStart.y },
          scale
        )
      );
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0 && scale <= MIN_SCALE + 0.02) reset();
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const nuevaEscala = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale - e.deltaY * 0.01));
    setScale(nuevaEscala);
    setTranslate((t) => clamp(t, nuevaEscala));
  };

  const onDoubleClick = () => (scale > 1 ? reset() : setScale(DOUBLE_TAP_ZOOM));

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction: "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          userSelect: "none",
        }}
      />
    </div>
  );
}
