import { useState } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { PeriodoPrograma } from "@/types/programa-predicacion";

interface PeriodoSelectorProps {
  periodo: PeriodoPrograma;
  onPeriodoChange: (periodo: PeriodoPrograma) => void;
  fechaInicio: Date;
  fechaFin: Date;
  onFechasChange: (inicio: Date, fin: Date) => void;
}

export function PeriodoSelector({
  periodo,
  onPeriodoChange,
  fechaInicio,
  fechaFin,
  onFechasChange,
}: PeriodoSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePeriodoChange = (nuevoPeriodo: PeriodoPrograma) => {
    onPeriodoChange(nuevoPeriodo);
    const hoy = new Date();
    let inicio: Date, fin: Date;

    switch (nuevoPeriodo) {
      case "semanal":
        inicio = startOfWeek(hoy, { weekStartsOn: 1 });
        fin = endOfWeek(hoy, { weekStartsOn: 1 });
        break;
      case "quincenal":
        inicio = startOfWeek(hoy, { weekStartsOn: 1 });
        fin = endOfWeek(addWeeks(hoy, 1), { weekStartsOn: 1 });
        break;
      case "mensual":
        inicio = startOfMonth(hoy);
        fin = endOfMonth(hoy);
        break;
    }
    onFechasChange(inicio, fin);
  };

  const navegarPeriodo = (direccion: "anterior" | "siguiente") => {
    const multiplicador = direccion === "anterior" ? -1 : 1;
    let nuevaInicio: Date, nuevaFin: Date;

    switch (periodo) {
      case "semanal":
        nuevaInicio = addWeeks(fechaInicio, multiplicador);
        nuevaFin = addWeeks(fechaFin, multiplicador);
        break;
      case "quincenal":
        nuevaInicio = addWeeks(fechaInicio, multiplicador * 2);
        nuevaFin = addWeeks(fechaFin, multiplicador * 2);
        break;
      case "mensual":
        nuevaInicio = addMonths(fechaInicio, multiplicador);
        nuevaFin = endOfMonth(nuevaInicio);
        break;
    }
    onFechasChange(nuevaInicio, nuevaFin);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    let inicio: Date, fin: Date;

    switch (periodo) {
      case "semanal":
        inicio = startOfWeek(date, { weekStartsOn: 1 });
        fin = endOfWeek(date, { weekStartsOn: 1 });
        break;
      case "quincenal":
        inicio = startOfWeek(date, { weekStartsOn: 1 });
        fin = endOfWeek(addWeeks(date, 1), { weekStartsOn: 1 });
        break;
      case "mensual":
        inicio = startOfMonth(date);
        fin = endOfMonth(date);
        break;
    }
    onFechasChange(inicio, fin);
    setCalendarOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={periodo} onValueChange={(v) => handlePeriodoChange(v as PeriodoPrograma)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="semanal">Semanal</SelectItem>
          <SelectItem value="quincenal">Quincenal</SelectItem>
          <SelectItem value="mensual">Mensual</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => navegarPeriodo("anterior")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[200px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(fechaInicio, "d MMM", { locale: es })} - {format(fechaFin, "d MMM yyyy", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fechaInicio}
              onSelect={handleDateSelect}
              locale={es}
            />
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="icon" onClick={() => navegarPeriodo("siguiente")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
