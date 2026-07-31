import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarHeart } from "lucide-react";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";

/** "29 - 30 sep" si comparten mes; "29 sep - 3 oct" si no. */
function formatearRangoFecha(fecha: string, fechaFin: string | null): string {
  const inicio = parseISO(fecha);
  if (!fechaFin) return format(inicio, "d MMM", { locale: es });
  const fin = parseISO(fechaFin);
  const mismoMes = inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear();
  if (mismoMes) {
    return `${format(inicio, "d", { locale: es })} - ${format(fin, "d MMM", { locale: es })}`;
  }
  return `${format(inicio, "d MMM", { locale: es })} - ${format(fin, "d MMM", { locale: es })}`;
}

/** Tarjeta de Inicio con los días especiales que el administrador marcó
 * con "Mostrar en Inicio" (independiente de a qué programas apliquen),
 * desde hoy en adelante. Visible para cualquier usuario logueado. */
export function EventosProximos() {
  const { diasEspeciales, isLoading } = useDiasEspeciales();
  const hoyStr = format(new Date(), "yyyy-MM-dd");

  const eventos = useMemo(() => {
    return diasEspeciales
      .filter((d) => d.mostrar_en_inicio && d.fecha && (d.fecha_fin || d.fecha) >= hoyStr)
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  }, [diasEspeciales, hoyStr]);

  if (!isLoading && eventos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarHeart className="h-4 w-4 text-primary" />
          Eventos futuros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          eventos.map((e) => (
            <div key={e.id} className="flex items-baseline gap-2 py-1.5 border-b last:border-b-0 text-sm">
              <span className="font-medium whitespace-nowrap">
                {formatearRangoFecha(e.fecha!, e.fecha_fin)}
              </span>
              <span className="text-muted-foreground truncate">{e.nombre}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
