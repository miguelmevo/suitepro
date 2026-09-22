import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { usePuntoEncuentroDeshabilitado } from "@/hooks/usePuntoEncuentroDeshabilitado";

/**
 * Deshabilitar un punto de encuentro en fechas puntuales, de un solo toque:
 * se toca el día "desde" y de inmediato el mismo calendario pide el "hasta";
 * al tocarlo se guarda y el popover se cierra solo. Tocar el mismo día dos
 * veces guarda una fecha única (sin fecha_fin).
 */
export function DeshabilitarPuntoEncuentro({ puntoEncuentroId, puntoNombre }: { puntoEncuentroId: string; puntoNombre: string }) {
  const { deshabilitadas, crear, eliminar } = usePuntoEncuentroDeshabilitado(puntoEncuentroId);

  const [open, setOpen] = useState(false);
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [motivo, setMotivo] = useState("");

  const formatearDia = (f: string) => format(new Date(f + "T00:00:00"), "d MMM yy", { locale: es });

  const handleSelect = (dia: Date | undefined) => {
    if (!dia) return;
    if (!fechaInicio) {
      setFechaInicio(dia);
      return;
    }
    const fin = dia.getTime() === fechaInicio.getTime() ? null : dia < fechaInicio ? fechaInicio : dia;
    const inicioFinal = dia < fechaInicio ? dia : fechaInicio;
    crear.mutate({
      punto_encuentro_id: puntoEncuentroId,
      fecha_inicio: format(inicioFinal, "yyyy-MM-dd"),
      fecha_fin: fin ? format(fin, "yyyy-MM-dd") : null,
      motivo: motivo.trim() || undefined,
    });
    setFechaInicio(undefined);
    setMotivo("");
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setFechaInicio(undefined);
            setMotivo("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <CalendarOff className="h-3.5 w-3.5" />
            Deshabilitar fechas
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 space-y-2" align="start">
          <p className="text-xs font-medium text-muted-foreground px-1">
            {!fechaInicio ? `Desde cuándo no está disponible ${puntoNombre}` : "¿Hasta cuándo? (toca el mismo día para una fecha única)"}
          </p>
          <Calendar
            mode="single"
            selected={fechaInicio}
            onSelect={handleSelect}
            defaultMonth={fechaInicio}
            locale={es}
          />
          <div className="space-y-1 px-1">
            <Label htmlFor="motivo-punto" className="text-xs">Motivo (opcional)</Label>
            <Input
              id="motivo-punto"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Salón en reparación"
              className="h-8 text-sm"
            />
          </div>
        </PopoverContent>
      </Popover>

      {deshabilitadas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {deshabilitadas.map((d) => (
            <Badge key={d.id} variant="outline" className="gap-1.5 pr-1 font-normal">
              <span>
                {formatearDia(d.fecha_inicio)}
                {d.fecha_fin && d.fecha_fin !== d.fecha_inicio ? ` – ${formatearDia(d.fecha_fin)}` : ""}
                {d.motivo ? ` · ${d.motivo}` : ""}
              </span>
              <button
                type="button"
                onClick={() => eliminar.mutate(d.id)}
                className="rounded-sm hover:bg-destructive/15 p-0.5"
                title="Quitar"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
