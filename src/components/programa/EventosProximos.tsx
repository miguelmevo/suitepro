import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarHeart } from "lucide-react";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";

const DIAS_ABREV = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** "Dom 29" o, si hay rango, "Vie 15 al dom 17". */
function formatearDiaEvento(fecha: string, fechaFin: string | null): string {
  const inicio = parseISO(fecha);
  const diaIni = `${DIAS_ABREV[inicio.getDay()]} ${format(inicio, "d")}`;
  if (!fechaFin) return diaIni;
  const fin = parseISO(fechaFin);
  const diaFin = `${DIAS_ABREV[fin.getDay()].toLowerCase()} ${format(fin, "d")}`;
  return `${diaIni} al ${diaFin}`;
}

/** Tarjeta de Inicio con los días especiales que el administrador marcó
 * con "Mostrar en Inicio" (independiente de a qué programas apliquen),
 * desde hoy en adelante, agrupados por mes. Visible para cualquier
 * usuario logueado. */
export function EventosProximos() {
  const { diasEspeciales, isLoading } = useDiasEspeciales();
  const hoyStr = format(new Date(), "yyyy-MM-dd");

  const eventos = useMemo(() => {
    return diasEspeciales
      .filter((d) => d.mostrar_en_inicio && d.fecha && (d.fecha_fin || d.fecha) >= hoyStr)
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  }, [diasEspeciales, hoyStr]);

  const porMes = useMemo(() => {
    const m: Record<string, typeof eventos> = {};
    eventos.forEach((e) => {
      const mesKey = format(parseISO(e.fecha!), "yyyy-MM");
      if (!m[mesKey]) m[mesKey] = [];
      m[mesKey].push(e);
    });
    return m;
  }, [eventos]);

  if (!isLoading && eventos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <CalendarHeart className="h-4 w-4 text-primary" />
          Eventos futuros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-2">Cargando...</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(porMes).map(([mesKey, items]) => (
              <div key={mesKey} className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {format(parseISO(`${mesKey}-01`), "MMMM yyyy", { locale: es })}
                </p>
                {items.map((e) => (
                  <div key={e.id} className="text-xs bg-muted/50 rounded px-2 py-1 leading-snug">
                    <span className="font-semibold text-primary">{formatearDiaEvento(e.fecha!, e.fecha_fin)}</span>
                    <span className="text-muted-foreground"> - </span>
                    <span>{e.nombre}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
