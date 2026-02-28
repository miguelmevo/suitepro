import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, CalendarIcon, Loader2, Undo2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCiclosTerritorios } from "@/hooks/useCiclosTerritorios";
import { cn } from "@/lib/utils";

interface ManzanaDisponible {
  id: string;
  letra: string;
}

interface RegistroManzanasTrabajadasProps {
  territorioId: string;
  congregacionId: string;
  manzanas: ManzanaDisponible[];
  onClose?: () => void;
}

export function RegistroManzanasTrabajadas({
  territorioId,
  congregacionId,
  manzanas,
  onClose,
}: RegistroManzanasTrabajadasProps) {
  const [fecha, setFecha] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const {
    cicloActivo,
    manzanasTrabajadas,
    trabajadasIds,
    marcarManzana,
    desmarcarManzana,
    isLoading,
  } = useCiclosTerritorios(territorioId, congregacionId);

  const disponibles = manzanas.filter((m) => !trabajadasIds.has(m.id));
  const trabajadas = manzanas.filter((m) => trabajadasIds.has(m.id));

  const handleMarcar = (manzanaId: string) => {
    marcarManzana.mutate({
      manzanaId,
      fechaTrabajada: format(fecha, "yyyy-MM-dd"),
    });
  };

  const handleDesmarcar = (manzanaId: string) => {
    const registro = manzanasTrabajadas.find((mt) => mt.manzana_id === manzanaId);
    if (registro) {
      desmarcarManzana.mutate(registro.id);
    }
  };

  const getFechaTrabajada = (manzanaId: string) => {
    const registro = manzanasTrabajadas.find((mt) => mt.manzana_id === manzanaId);
    if (!registro) return null;
    return format(new Date(registro.fecha_trabajada + "T12:00:00"), "dd/MM/yyyy");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Fecha:</span>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(fecha, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fecha}
              onSelect={(d) => {
                if (d) {
                  setFecha(d);
                  setCalendarOpen(false);
                }
              }}
              locale={es}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Available blocks */}
      {disponibles.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Manzanas disponibles</p>
          <div className="flex flex-wrap gap-2">
            {disponibles.map((m) => (
              <Button
                key={m.id}
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0 text-base font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => handleMarcar(m.id)}
                disabled={marcarManzana.isPending}
              >
                {m.letra}
              </Button>
            ))}
          </div>
        </div>
      )}

      {disponibles.length === 0 && manzanas.length > 0 && (
        <p className="text-sm text-muted-foreground italic">
          Todas las manzanas han sido trabajadas en este ciclo.
        </p>
      )}

      {/* Worked blocks - grouped by date */}
      {trabajadas.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Manzanas trabajadas</p>
          <div className="flex flex-wrap gap-2">
            {(() => {
              // Group by date
              const byDate = new Map<string, typeof trabajadas>();
              trabajadas.forEach((m) => {
                const fecha = getFechaTrabajada(m.id) || "?";
                if (!byDate.has(fecha)) byDate.set(fecha, []);
                byDate.get(fecha)!.push(m);
              });
              return Array.from(byDate.entries()).map(([fecha, letras]) => (
                <div key={fecha} className="flex items-center gap-1">
                  <Badge
                    variant="default"
                    className={cn(
                      "gap-1 px-2 py-1 cursor-default",
                      "bg-green-600 hover:bg-green-700 text-white"
                    )}
                  >
                    <Check className="h-3 w-3" />
                    {letras.map((l) => l.letra).join(" - ")}
                    <span className="text-[10px] opacity-80 ml-1">
                      {fecha}
                    </span>
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      letras.forEach((m) => {
                        const registro = manzanasTrabajadas.find((mt) => mt.manzana_id === m.id);
                        if (registro) desmarcarManzana.mutate(registro.id);
                      });
                    }}
                    disabled={desmarcarManzana.isPending}
                    title={`Desmarcar todas (${letras.map((l) => l.letra).join(", ")})`}
                  >
                    <Undo2 className="h-3 w-3" />
                  </Button>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Cycle info */}
      {cicloActivo && (
        <p className="text-xs text-muted-foreground">
          Ciclo #{cicloActivo.ciclo_numero} · Inicio: {format(new Date(cicloActivo.fecha_inicio + "T12:00:00"), "dd/MM/yyyy")}
        </p>
      )}

      {/* Close / Done button */}
      {onClose && (
        <div className="pt-2">
          <Button size="sm" className="gap-2" onClick={onClose}>
            <Send className="h-4 w-4" />
            Listo
          </Button>
        </div>
      )}
    </div>
  );
}
