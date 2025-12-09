import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Plus, X, Pencil, Trash2 } from "lucide-react";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";

interface EntradaCeldaFormProps {
  fecha: string;
  horario: HorarioSalida;
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  entrada?: ProgramaConDetalles;
  onSubmit: (data: {
    fecha: string;
    horario_id: string;
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
  }) => void;
  onUpdate?: (id: string, data: {
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
  }) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  isInline?: boolean;
}

export function EntradaCeldaForm({
  fecha,
  horario,
  puntos,
  territorios,
  participantes,
  entrada,
  onSubmit,
  onUpdate,
  onDelete,
  isLoading,
  isInline,
}: EntradaCeldaFormProps) {
  const [open, setOpen] = useState(false);
  const [puntoId, setPuntoId] = useState("");
  const [territorioId, setTerritorioId] = useState("");
  const [capitanId, setCapitanId] = useState("");

  const isEditing = !!entrada;

  useEffect(() => {
    if (entrada) {
      setPuntoId(entrada.punto_encuentro_id || "");
      setTerritorioId(entrada.territorio_id || "");
      setCapitanId(entrada.capitan_id || "");
    }
  }, [entrada]);

  const handleSubmit = () => {
    if (isEditing && onUpdate) {
      onUpdate(entrada.id, {
        punto_encuentro_id: puntoId || undefined,
        territorio_id: territorioId || undefined,
        capitan_id: capitanId || undefined,
      });
    } else {
      onSubmit({
        fecha,
        horario_id: horario.id,
        punto_encuentro_id: puntoId || undefined,
        territorio_id: territorioId || undefined,
        capitan_id: capitanId || undefined,
      });
    }
    if (!isInline) {
      setOpen(false);
      resetForm();
    }
  };

  const handleDelete = () => {
    if (entrada && onDelete) {
      onDelete(entrada.id);
      if (!isInline) {
        setOpen(false);
      }
    }
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

  // Render inline (sin popover wrapper)
  if (isInline) {
    return (
      <FormContent
        title={`Editar salida - ${horario.hora.slice(0, 5)}`}
        puntoId={puntoId}
        territorioId={territorioId}
        capitanId={capitanId}
        puntos={puntos}
        territorios={territorios}
        participantes={participantes}
        onPuntoChange={setPuntoId}
        onTerritorioChange={setTerritorioId}
        onCapitanChange={setCapitanId}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onDelete={handleDelete}
        isLoading={isLoading}
        submitLabel="Actualizar"
        showDelete
      />
    );
  }

  // Render para celdas vacías (agregar)
  if (!isEditing) {
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
          <FormContent
            title={`Agregar salida - ${horario.hora.slice(0, 5)}`}
            puntoId={puntoId}
            territorioId={territorioId}
            capitanId={capitanId}
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
            onPuntoChange={setPuntoId}
            onTerritorioChange={setTerritorioId}
            onCapitanChange={setCapitanId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            submitLabel="Guardar"
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Render para celdas con datos (editar)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className="w-full h-full min-h-[60px] flex items-center justify-center hover:bg-primary/5 transition-colors cursor-pointer group relative"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/80 transition-opacity">
            <Pencil className="h-4 w-4 text-primary" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border shadow-lg z-50" align="start">
        <FormContent
          title={`Editar salida - ${horario.hora.slice(0, 5)}`}
          puntoId={puntoId}
          territorioId={territorioId}
          capitanId={capitanId}
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
          onPuntoChange={setPuntoId}
          onTerritorioChange={setTerritorioId}
          onCapitanChange={setCapitanId}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onDelete={handleDelete}
          isLoading={isLoading}
          submitLabel="Actualizar"
          showDelete
        />
      </PopoverContent>
    </Popover>
  );
}

interface FormContentProps {
  title: string;
  puntoId: string;
  territorioId: string;
  capitanId: string;
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  onPuntoChange: (value: string) => void;
  onTerritorioChange: (value: string) => void;
  onCapitanChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  isLoading?: boolean;
  submitLabel: string;
  showDelete?: boolean;
}

function FormContent({
  title,
  puntoId,
  territorioId,
  capitanId,
  puntos,
  territorios,
  participantes,
  onPuntoChange,
  onTerritorioChange,
  onCapitanChange,
  onSubmit,
  onCancel,
  onDelete,
  isLoading,
  submitLabel,
  showDelete,
}: FormContentProps) {
  return (
    <div className="space-y-3">
      <div className="font-medium text-sm border-b pb-2 flex items-center justify-between">
        <span>{title}</span>
        {showDelete && onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Punto de encuentro</label>
        <Select value={puntoId} onValueChange={onPuntoChange}>
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
        <Select value={territorioId} onValueChange={onTerritorioChange}>
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
        <Select value={capitanId} onValueChange={onCapitanChange}>
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
          onClick={onCancel}
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button 
          size="sm" 
          className="flex-1"
          onClick={onSubmit}
          disabled={isLoading}
        >
          <Check className="h-4 w-4 mr-1" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
