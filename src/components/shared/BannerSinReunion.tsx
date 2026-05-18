import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  motivo: string;
  fecha?: string | Date | null;
  color?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Banner a lo ancho usado cuando una reunión queda cancelada por un Día Especial
 * (Asamblea, Conmemoración, etc.). Se usa en vistas públicas y en los PDFs.
 */
export function BannerSinReunion({ motivo, fecha, color = "#1e3a5f", compact = false, className = "" }: Props) {
  let fechaLabel = "";
  if (fecha) {
    try {
      const d = typeof fecha === "string" ? parseISO(fecha) : fecha;
      const raw = format(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
      fechaLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={`w-full rounded-md text-center text-white ${compact ? "py-4 px-3" : "py-8 px-4"} ${className}`}
      style={{ backgroundColor: color }}
    >
      <div className={`font-bold uppercase tracking-wide ${compact ? "text-base" : "text-xl"}`}>
        {motivo}
      </div>
      <div className={`mt-1 ${compact ? "text-xs" : "text-sm"} opacity-90`}>
        No hay reunión{fechaLabel ? ` — ${fechaLabel}` : ""}
      </div>
    </div>
  );
}
