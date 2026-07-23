import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface Props {
  mes: number; // 0-11
  anio: number;
  onChange: (mes: number, anio: number) => void;
}

// Botón con ícono de calendario que abre un selector de mes/año directo,
// para no tener que ir mes a mes con las flechas.
export function SelectorMesPopover({ mes, anio, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [anioVisible, setAnioVisible] = useState(anio);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setAnioVisible(anio);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" title="Ir a un mes específico">
          <CalendarDays className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <div className="flex items-center justify-between mb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAnioVisible((a) => a - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm">{anioVisible}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAnioVisible((a) => a + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MESES_CORTOS.map((m, i) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={anioVisible === anio && i === mes ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => {
                onChange(i, anioVisible);
                setOpen(false);
              }}
            >
              {m}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
