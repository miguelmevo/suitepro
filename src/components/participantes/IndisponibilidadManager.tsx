import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarOff, Plus, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useIndisponibilidadParticipantes,
  TIPOS_RESPONSABILIDAD,
} from "@/hooks/useIndisponibilidadParticipantes";

interface IndisponibilidadManagerProps {
  participanteId: string;
  participanteNombre?: string;
}

export function IndisponibilidadManager({
  participanteId,
  participanteNombre,
}: IndisponibilidadManagerProps) {
  const {
    indisponibilidades,
    isLoading,
    crearIndisponibilidad,
    eliminarIndisponibilidad,
  } = useIndisponibilidadParticipantes(participanteId);

  const [open, setOpen] = useState(false);
  const [fechaInicio, setFechaInicio] = useState<Date>();
  const [fechaFin, setFechaFin] = useState<Date>();
  const [esRango, setEsRango] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(["todas"]);

  const resetForm = () => {
    setFechaInicio(undefined);
    setFechaFin(undefined);
    setEsRango(false);
    setMotivo("");
    setTiposSeleccionados(["todas"]);
  };

  const handleSubmit = async () => {
    if (!fechaInicio) return;

    await crearIndisponibilidad.mutateAsync({
      participante_id: participanteId,
      fecha_inicio: format(fechaInicio, "yyyy-MM-dd"),
      fecha_fin: esRango && fechaFin ? format(fechaFin, "yyyy-MM-dd") : null,
      motivo: motivo || undefined,
      tipo_responsabilidad: tiposSeleccionados,
    });

    resetForm();
    setOpen(false);
  };

  const handleTipoChange = (tipo: string, checked: boolean) => {
    if (tipo === "todas") {
      setTiposSeleccionados(checked ? ["todas"] : []);
    } else {
      let newTipos = tiposSeleccionados.filter((t) => t !== "todas");
      if (checked) {
        newTipos.push(tipo);
      } else {
        newTipos = newTipos.filter((t) => t !== tipo);
      }
      setTiposSeleccionados(newTipos.length > 0 ? newTipos : ["todas"]);
    }
  };

  const formatFechaDisplay = (fechaInicio: string, fechaFin: string | null) => {
    const inicio = new Date(fechaInicio + "T00:00:00");
    if (fechaFin) {
      const fin = new Date(fechaFin + "T00:00:00");
      return `${format(inicio, "d MMM", { locale: es })} - ${format(fin, "d MMM yyyy", { locale: es })}`;
    }
    return format(inicio, "d MMMM yyyy", { locale: es });
  };

  const getTipoLabel = (tipos: string[]) => {
    if (tipos.includes("todas")) return "Todas";
    return tipos
      .map((t) => TIPOS_RESPONSABILIDAD.find((tr) => tr.value === t)?.label || t)
      .join(", ");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Fechas no disponible</span>
          {indisponibilidades.length > 0 && (
            <Badge variant="secondary">{indisponibilidades.length}</Badge>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Agregar indisponibilidad
                {participanteNombre && (
                  <span className="text-muted-foreground font-normal ml-2">
                    - {participanteNombre}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Tipo de fecha */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="esRango"
                  checked={esRango}
                  onCheckedChange={(checked) => {
                    setEsRango(checked === true);
                    if (!checked) setFechaFin(undefined);
                  }}
                />
                <Label htmlFor="esRango" className="text-sm">
                  Es un rango de fechas
                </Label>
              </div>

              {/* Fecha inicio */}
              <div className="space-y-2">
                <Label>{esRango ? "Fecha inicio" : "Fecha"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fechaInicio && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {fechaInicio
                        ? format(fechaInicio, "PPP", { locale: es })
                        : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={fechaInicio}
                      onSelect={setFechaInicio}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Fecha fin (si es rango) */}
              {esRango && (
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !fechaFin && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {fechaFin
                          ? format(fechaFin, "PPP", { locale: es })
                          : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={fechaFin}
                        onSelect={setFechaFin}
                        disabled={(date) =>
                          fechaInicio ? date < fechaInicio : false
                        }
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Motivo */}
              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Vacaciones, viaje, enfermedad..."
                />
              </div>

              {/* Tipos de responsabilidad */}
              <div className="space-y-2">
                <Label>Aplica para</Label>
                <div className="space-y-2 border rounded-md p-3">
                  {TIPOS_RESPONSABILIDAD.map((tipo) => (
                    <div key={tipo.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`tipo-${tipo.value}`}
                        checked={tiposSeleccionados.includes(tipo.value)}
                        onCheckedChange={(checked) =>
                          handleTipoChange(tipo.value, checked === true)
                        }
                        disabled={
                          tipo.value !== "todas" &&
                          tiposSeleccionados.includes("todas")
                        }
                      />
                      <Label
                        htmlFor={`tipo-${tipo.value}`}
                        className="text-sm font-normal"
                      >
                        {tipo.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!fechaInicio || crearIndisponibilidad.isPending}
                className="w-full"
              >
                {crearIndisponibilidad.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de indisponibilidades */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : indisponibilidades.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Sin fechas de indisponibilidad registradas
        </p>
      ) : (
        <div className="space-y-2">
          {indisponibilidades.map((ind) => (
            <div
              key={ind.id}
              className="flex items-center justify-between p-2 border rounded-md bg-muted/30"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CalendarOff className="h-3 w-3 text-destructive" />
                  <span className="text-sm font-medium">
                    {formatFechaDisplay(ind.fecha_inicio, ind.fecha_fin)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getTipoLabel(ind.tipo_responsabilidad)}
                  </Badge>
                  {ind.motivo && (
                    <span className="text-xs text-muted-foreground">
                      {ind.motivo}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => eliminarIndisponibilidad.mutate(ind.id)}
                disabled={eliminarIndisponibilidad.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
