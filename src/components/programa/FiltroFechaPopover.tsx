import { useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function formatFechaCorta(fecha: string) {
  try {
    return format(parseISO(fecha), "d MMM yy", { locale: es });
  } catch {
    return fecha;
  }
}

interface FiltroFechaPopoverProps {
  desde: string;
  hasta: string;
  onChangeDesde: (v: string) => void;
  onChangeHasta: (v: string) => void;
  onEliminar: () => void;
}

// Filtro de rango de fechas genérico y reutilizable (sin conocimiento del dominio):
// "" en desde/hasta significa "sin límite" en ese extremo.
export function FiltroFechaPopover({ desde, hasta, onChangeDesde, onChangeHasta, onEliminar }: FiltroFechaPopoverProps) {
  const [open, setOpen] = useState(false);
  const hayFiltro = !!desde || !!hasta;

  const aplicarRangoRapido = (dias: number) => {
    const hoy = new Date();
    onChangeHasta(format(hoy, "yyyy-MM-dd"));
    onChangeDesde(format(subDays(hoy, dias), "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-primary whitespace-nowrap">Filtro por fecha:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="rounded-r-none border-r-0">
            <CalendarRange className="h-4 w-4 mr-1" />
            {hayFiltro
              ? `${desde ? formatFechaCorta(desde) : "…"} – ${hasta ? formatFechaCorta(hasta) : "…"}`
              : "Todo el historial"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Rangos rápidos</Label>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="secondary" size="sm" onClick={() => aplicarRangoRapido(30)}>
                Últimos 30 días
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => aplicarRangoRapido(90)}>
                Últimos 3 meses
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => aplicarRangoRapido(180)}>
                Últimos 6 meses
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={desde} onChange={(e) => onChangeDesde(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => onChangeHasta(e.target.value)} />
            </div>
          </div>
          {hayFiltro && (
            <Button type="button" variant="default" size="sm" className="w-full" onClick={onEliminar}>
              Eliminar filtro
            </Button>
          )}
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`rounded-l-none px-2 ${hayFiltro ? "text-primary hover:text-primary" : "text-muted-foreground opacity-40 cursor-not-allowed hover:bg-background"}`}
        disabled={!hayFiltro}
        onClick={(e) => {
          e.stopPropagation();
          onEliminar();
        }}
        aria-label="Eliminar filtro de fecha"
        title="Eliminar filtro de fecha"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
