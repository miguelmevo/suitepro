import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Plus, X, Pencil, Trash2, Calendar, ChevronsUpDown } from "lucide-react";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DiaEspecial {
  id: string;
  nombre: string;
  fecha: string;
  bloqueo_tipo: string;
}

interface EntradaCeldaFormProps {
  fecha: string;
  horario: HorarioSalida;
  horarios: HorarioSalida[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  diasEspeciales?: DiaEspecial[];
  entrada?: ProgramaConDetalles;
  onSubmit: (data: {
    fecha: string;
    horario_id: string;
    punto_encuentro_id?: string;
    territorio_id?: string;
    territorio_ids?: string[];
    capitan_id?: string;
    es_mensaje_especial?: boolean;
    mensaje_especial?: string;
    colspan_completo?: boolean;
  }) => void;
  onUpdate?: (id: string, data: {
    punto_encuentro_id?: string;
    territorio_id?: string;
    territorio_ids?: string[];
    capitan_id?: string;
    horario_id?: string;
    es_mensaje_especial?: boolean;
    mensaje_especial?: string;
    colspan_completo?: boolean;
  }) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  isInline?: boolean;
}

export function EntradaCeldaForm({
  fecha,
  horario,
  horarios,
  puntos,
  territorios,
  participantes,
  diasEspeciales = [],
  entrada,
  onSubmit,
  onUpdate,
  onDelete,
  isLoading,
  isInline,
}: EntradaCeldaFormProps) {
  const [open, setOpen] = useState(false);
  const [puntoId, setPuntoId] = useState("");
  const [territorioIds, setTerritorioIds] = useState<string[]>([]);
  const [capitanId, setCapitanId] = useState("");
  const [horarioId, setHorarioId] = useState(horario.id);
  const [esDiaEspecial, setEsDiaEspecial] = useState(false);
  const [diaEspecialId, setDiaEspecialId] = useState("");

  const isEditing = !!entrada;

  // Filtrar horarios del mismo periodo (mañana/tarde)
  const horarioActualHora = parseInt(horario.hora.split(":")[0]);
  const esManana = horarioActualHora < 14;
  const horariosDisponibles = horarios.filter(h => {
    const hora = parseInt(h.hora.split(":")[0]);
    return esManana ? hora < 14 : hora >= 14;
  });

  useEffect(() => {
    if (entrada) {
      setPuntoId(entrada.punto_encuentro_id || "");
      // Usar territorio_ids si existe, sino fallback a territorio_id
      const ids = entrada.territorio_ids?.length > 0 
        ? entrada.territorio_ids 
        : (entrada.territorio_id ? [entrada.territorio_id] : []);
      setTerritorioIds(ids);
      setCapitanId(entrada.capitan_id || "");
      setHorarioId(entrada.horario_id || horario.id);
      setEsDiaEspecial(entrada.es_mensaje_especial || false);
    }
  }, [entrada, horario.id]);

  useEffect(() => {
    setHorarioId(horario.id);
  }, [horario.id]);

  const handleTerritorioToggle = (territorioId: string) => {
    setTerritorioIds(prev => 
      prev.includes(territorioId)
        ? prev.filter(id => id !== territorioId)
        : [...prev, territorioId]
    );
  };

  const handleSubmit = () => {
    if (esDiaEspecial && diaEspecialId) {
      const diaEspecial = diasEspeciales.find(d => d.id === diaEspecialId);
      if (isEditing && onUpdate) {
        onUpdate(entrada.id, {
          es_mensaje_especial: true,
          mensaje_especial: diaEspecial?.nombre || "",
          colspan_completo: true,
          punto_encuentro_id: undefined,
          territorio_id: undefined,
          territorio_ids: [],
          capitan_id: undefined,
          horario_id: horarioId,
        });
      } else {
        onSubmit({
          fecha,
          horario_id: horarioId,
          es_mensaje_especial: true,
          mensaje_especial: diaEspecial?.nombre || "",
          colspan_completo: true,
        });
      }
    } else if (isEditing && onUpdate) {
      onUpdate(entrada.id, {
        punto_encuentro_id: puntoId || undefined,
        territorio_ids: territorioIds,
        capitan_id: capitanId || undefined,
        horario_id: horarioId,
        es_mensaje_especial: false,
        mensaje_especial: undefined,
        colspan_completo: false,
      });
    } else {
      // Crear una sola entrada con todos los territorios
      onSubmit({
        fecha,
        horario_id: horarioId,
        punto_encuentro_id: puntoId || undefined,
        territorio_ids: territorioIds,
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
    setTerritorioIds([]);
    setCapitanId("");
    setHorarioId(horario.id);
    setEsDiaEspecial(false);
    setDiaEspecialId("");
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
        territorioIds={territorioIds}
        capitanId={capitanId}
        horarioId={horarioId}
        esDiaEspecial={esDiaEspecial}
        diaEspecialId={diaEspecialId}
        puntos={puntos}
        territorios={territorios}
        participantes={participantes}
        horarios={horariosDisponibles}
        diasEspeciales={diasEspeciales}
        onPuntoChange={setPuntoId}
        onTerritorioToggle={handleTerritorioToggle}
        onCapitanChange={setCapitanId}
        onHorarioChange={setHorarioId}
        onEsDiaEspecialChange={setEsDiaEspecial}
        onDiaEspecialChange={setDiaEspecialId}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onDelete={handleDelete}
        isLoading={isLoading}
        submitLabel="Actualizar"
        showDelete
        showHorarioSelector={horariosDisponibles.length > 1}
        isEditing={isEditing}
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
            territorioIds={territorioIds}
            capitanId={capitanId}
            horarioId={horarioId}
            esDiaEspecial={esDiaEspecial}
            diaEspecialId={diaEspecialId}
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
            horarios={horariosDisponibles}
            diasEspeciales={diasEspeciales}
            onPuntoChange={setPuntoId}
            onTerritorioToggle={handleTerritorioToggle}
            onCapitanChange={setCapitanId}
            onHorarioChange={setHorarioId}
            onEsDiaEspecialChange={setEsDiaEspecial}
            onDiaEspecialChange={setDiaEspecialId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            submitLabel="Guardar"
            showHorarioSelector={horariosDisponibles.length > 1}
            isEditing={false}
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
          territorioIds={territorioIds}
          capitanId={capitanId}
          horarioId={horarioId}
          esDiaEspecial={esDiaEspecial}
          diaEspecialId={diaEspecialId}
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
          horarios={horariosDisponibles}
          diasEspeciales={diasEspeciales}
          onPuntoChange={setPuntoId}
          onTerritorioToggle={handleTerritorioToggle}
          onCapitanChange={setCapitanId}
          onHorarioChange={setHorarioId}
          onEsDiaEspecialChange={setEsDiaEspecial}
          onDiaEspecialChange={setDiaEspecialId}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onDelete={handleDelete}
          isLoading={isLoading}
          submitLabel="Actualizar"
          showDelete
          showHorarioSelector={horariosDisponibles.length > 1}
          isEditing={true}
        />
      </PopoverContent>
    </Popover>
  );
}

interface FormContentProps {
  title: string;
  puntoId: string;
  territorioIds: string[];
  capitanId: string;
  horarioId: string;
  esDiaEspecial: boolean;
  diaEspecialId: string;
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  horarios: HorarioSalida[];
  diasEspeciales: DiaEspecial[];
  onPuntoChange: (value: string) => void;
  onTerritorioToggle: (territorioId: string) => void;
  onCapitanChange: (value: string) => void;
  onHorarioChange: (value: string) => void;
  onEsDiaEspecialChange: (value: boolean) => void;
  onDiaEspecialChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  isLoading?: boolean;
  submitLabel: string;
  showDelete?: boolean;
  showHorarioSelector?: boolean;
  isEditing?: boolean;
}

function FormContent({
  title,
  puntoId,
  territorioIds,
  capitanId,
  horarioId,
  esDiaEspecial,
  diaEspecialId,
  puntos,
  territorios,
  participantes,
  horarios,
  diasEspeciales,
  onPuntoChange,
  onTerritorioToggle,
  onCapitanChange,
  onHorarioChange,
  onEsDiaEspecialChange,
  onDiaEspecialChange,
  onSubmit,
  onCancel,
  onDelete,
  isLoading,
  submitLabel,
  showDelete,
  showHorarioSelector,
  isEditing,
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

      {/* Selector de horario alternativo */}
      {showHorarioSelector && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Hora de salida</label>
          <Select value={horarioId} onValueChange={onHorarioChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Seleccionar hora..." />
            </SelectTrigger>
            <SelectContent className="bg-popover border shadow-lg z-[100]">
              {horarios.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.hora.slice(0, 5)} - {h.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Toggle para día especial */}
      {diasEspeciales.length > 0 && (
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="dia-especial-toggle" className="text-xs font-medium">
              Día especial
            </Label>
          </div>
          <Switch
            id="dia-especial-toggle"
            checked={esDiaEspecial}
            onCheckedChange={onEsDiaEspecialChange}
          />
        </div>
      )}

      {esDiaEspecial ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Seleccionar día especial</label>
          <Select value={diaEspecialId} onValueChange={onDiaEspecialChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent className="bg-popover border shadow-lg z-[100]">
              {diasEspeciales.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Se mostrará como mensaje especial en el programa
          </p>
        </div>
      ) : (
        <>
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
            <label className="text-xs font-medium text-muted-foreground">
              Territorios {territorioIds.length > 0 && `(${territorioIds.length})`}
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="h-9 w-full justify-between font-normal"
                >
                  {territorioIds.length === 0 
                    ? "Seleccionar territorios..."
                    : territorioIds.length === 1
                      ? territorios.find(t => t.id === territorioIds[0])?.numero || "1 seleccionado"
                      : `${territorioIds.length} territorios`
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-popover border shadow-lg z-[100]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar territorio..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron territorios.</CommandEmpty>
                    <CommandGroup>
                      {territorios.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={`${t.numero} ${t.nombre || ""}`}
                          onSelect={() => onTerritorioToggle(t.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              territorioIds.includes(t.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {t.numero} {t.nombre && `- ${t.nombre}`}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {territorioIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {territorioIds.map(id => {
                  const t = territorios.find(ter => ter.id === id);
                  return t ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {t.numero}
                      <button
                        type="button"
                        className="ml-1 hover:text-destructive"
                        onClick={() => onTerritorioToggle(id)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
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
        </>
      )}

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
          disabled={isLoading || (esDiaEspecial && !diaEspecialId)}
        >
          <Check className="h-4 w-4 mr-1" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
