import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Plus, X } from "lucide-react";
import { HorarioSalida, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";

interface EntradaCeldaFormProps {
  fecha: string;
  horario: HorarioSalida;
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  onSubmit: (data: {
    fecha: string;
    horario_id: string;
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
  }) => void;
  isLoading?: boolean;
}

export function EntradaCeldaForm({
  fecha,
  horario,
  puntos,
  territorios,
  participantes,
  onSubmit,
  isLoading,
}: EntradaCeldaFormProps) {
  const [open, setOpen] = useState(false);
  const [puntoId, setPuntoId] = useState("");
  const [territorioId, setTerritorioId] = useState("");
  const [capitanId, setCapitanId] = useState("");

  const handleSubmit = () => {
    onSubmit({
      fecha,
      horario_id: horario.id,
      punto_encuentro_id: puntoId || undefined,
      territorio_id: territorioId || undefined,
      capitan_id: capitanId || undefined,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setPuntoId("");
    setTerritorioId("");
    setCapitanId("");
  };

  const handleCancel = () => {
    setOpen(false);
    resetForm();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className="w-full h-full min-h-[60px] flex items-center justify-center text-muted-foreground/50 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer group"
        >
          <Plus className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border shadow-lg z-50" align="start">
        <div className="space-y-3">
          <div className="font-medium text-sm border-b pb-2">
            Agregar salida - {horario.hora.slice(0, 5)}
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Punto de encuentro</label>
            <Select value={puntoId} onValueChange={setPuntoId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-[100]">
                {puntos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Territorio</label>
            <Select value={territorioId} onValueChange={setTerritorioId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-[100]">
                {territorios.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.numero} {t.nombre && `- ${t.nombre}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Capitán</label>
            <Select value={capitanId} onValueChange={setCapitanId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-[100]">
                {participantes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} {p.apellido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={handleCancel}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              <Check className="h-4 w-4 mr-1" />
              Guardar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
