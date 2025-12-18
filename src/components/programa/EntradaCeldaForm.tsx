import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Check, Plus, X, Pencil, Trash2, Calendar, ChevronsUpDown, Users, UserCheck } from "lucide-react";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio, AsignacionGrupo } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { AsignacionGruposForm } from "./AsignacionGruposForm";
import { AsignacionGrupoIndividualForm } from "./AsignacionGrupoIndividualForm";

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
  gruposPredicacion?: GrupoPredicacion[];
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
    es_por_grupos?: boolean;
    asignaciones_grupos?: AsignacionGrupo[];
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
    es_por_grupos?: boolean;
    asignaciones_grupos?: AsignacionGrupo[];
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
  gruposPredicacion = [],
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
  const [esPorGrupos, setEsPorGrupos] = useState(false);
  const [esPorGrupoIndividual, setEsPorGrupoIndividual] = useState(false);
  const [asignacionesGrupos, setAsignacionesGrupos] = useState<AsignacionGrupo[]>([]);

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
      setEsPorGrupos(entrada.es_por_grupos || false);
      setAsignacionesGrupos(entrada.asignaciones_grupos || []);
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
          es_por_grupos: false,
          asignaciones_grupos: [],
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
    } else if (esPorGrupos || esPorGrupoIndividual) {
      if (isEditing && onUpdate) {
        onUpdate(entrada.id, {
          es_por_grupos: true,
          asignaciones_grupos: asignacionesGrupos,
          punto_encuentro_id: undefined,
          territorio_ids: [],
          capitan_id: undefined,
          horario_id: horarioId,
          es_mensaje_especial: false,
          mensaje_especial: undefined,
          colspan_completo: false,
        });
      } else {
        onSubmit({
          fecha,
          horario_id: horarioId,
          es_por_grupos: true,
          asignaciones_grupos: asignacionesGrupos,
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
        es_por_grupos: false,
        asignaciones_grupos: [],
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
    setOpen(false);
    resetForm();
  };

  const handleAsignacionesSubmit = (asignaciones: AsignacionGrupo[]) => {
    setAsignacionesGrupos(asignaciones);
    // Auto-submit when assigning groups
    if (isEditing && onUpdate) {
      onUpdate(entrada!.id, {
        es_por_grupos: true,
        asignaciones_grupos: asignaciones,
        punto_encuentro_id: undefined,
        territorio_ids: [],
        capitan_id: undefined,
        horario_id: horarioId,
        es_mensaje_especial: false,
        mensaje_especial: undefined,
        colspan_completo: false,
      });
    } else {
      onSubmit({
        fecha,
        horario_id: horarioId,
        es_por_grupos: true,
        asignaciones_grupos: asignaciones,
      });
    }
    setOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (entrada && onDelete) {
      onDelete(entrada.id);
      setOpen(false);
    }
  };

  const resetForm = () => {
    setPuntoId("");
    setTerritorioIds([]);
    setCapitanId("");
    setHorarioId(horario.id);
    setEsDiaEspecial(false);
    setDiaEspecialId("");
    setEsPorGrupos(false);
    setEsPorGrupoIndividual(false);
    setAsignacionesGrupos([]);
  };

  const handleCancel = () => {
    setOpen(false);
    resetForm();
  };

  // Handler para switches mutuamente excluyentes
  const handleEsDiaEspecialChange = (value: boolean) => {
    setEsDiaEspecial(value);
    if (value) {
      setEsPorGrupos(false);
      setEsPorGrupoIndividual(false);
    }
  };

  const handleEsPorGruposChange = (value: boolean) => {
    setEsPorGrupos(value);
    if (value) {
      setEsDiaEspecial(false);
      setEsPorGrupoIndividual(false);
    }
  };

  const handleEsPorGrupoIndividualChange = (value: boolean) => {
    setEsPorGrupoIndividual(value);
    if (value) {
      setEsDiaEspecial(false);
      setEsPorGrupos(false);
    }
  };

  // Render inline (sin dialog wrapper)
  if (isInline) {
    return (
      <FormContent
        title="Crear Nueva Salida"
        puntoId={puntoId}
        territorioIds={territorioIds}
        capitanId={capitanId}
        horarioId={horarioId}
        esDiaEspecial={esDiaEspecial}
        diaEspecialId={diaEspecialId}
        esPorGrupos={esPorGrupos}
        esPorGrupoIndividual={esPorGrupoIndividual}
        asignacionesGrupos={asignacionesGrupos}
        puntos={puntos}
        territorios={territorios}
        participantes={participantes}
        gruposPredicacion={gruposPredicacion}
        horarios={horariosDisponibles}
        diasEspeciales={diasEspeciales}
        onPuntoChange={setPuntoId}
        onTerritorioToggle={handleTerritorioToggle}
        onCapitanChange={setCapitanId}
        onHorarioChange={setHorarioId}
        onEsDiaEspecialChange={handleEsDiaEspecialChange}
        onDiaEspecialChange={setDiaEspecialId}
        onEsPorGruposChange={handleEsPorGruposChange}
        onEsPorGrupoIndividualChange={handleEsPorGrupoIndividualChange}
        onAsignacionesSubmit={handleAsignacionesSubmit}
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button 
            className="w-full h-full min-h-[60px] flex items-center justify-center text-muted-foreground/50 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer group"
          >
            <Plus className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <FormContent
            title="Crear Nueva Salida"
            puntoId={puntoId}
            territorioIds={territorioIds}
            capitanId={capitanId}
            horarioId={horarioId}
            esDiaEspecial={esDiaEspecial}
            diaEspecialId={diaEspecialId}
            esPorGrupos={esPorGrupos}
            esPorGrupoIndividual={esPorGrupoIndividual}
            asignacionesGrupos={asignacionesGrupos}
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
            gruposPredicacion={gruposPredicacion}
            horarios={horariosDisponibles}
            diasEspeciales={diasEspeciales}
            onPuntoChange={setPuntoId}
            onTerritorioToggle={handleTerritorioToggle}
            onCapitanChange={setCapitanId}
            onHorarioChange={setHorarioId}
            onEsDiaEspecialChange={handleEsDiaEspecialChange}
            onDiaEspecialChange={setDiaEspecialId}
            onEsPorGruposChange={handleEsPorGruposChange}
            onEsPorGrupoIndividualChange={handleEsPorGrupoIndividualChange}
            onAsignacionesSubmit={handleAsignacionesSubmit}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            submitLabel="Guardar"
            showHorarioSelector={horariosDisponibles.length > 1}
            isEditing={false}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Render para celdas con datos (editar)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button 
          className="w-full h-full min-h-[60px] flex items-center justify-center hover:bg-primary/5 transition-colors cursor-pointer group relative"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/80 transition-opacity">
            <Pencil className="h-4 w-4 text-primary" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <FormContent
          title="Crear Nueva Salida"
          puntoId={puntoId}
          territorioIds={territorioIds}
          capitanId={capitanId}
          horarioId={horarioId}
          esDiaEspecial={esDiaEspecial}
          diaEspecialId={diaEspecialId}
          esPorGrupos={esPorGrupos}
          esPorGrupoIndividual={esPorGrupoIndividual}
          asignacionesGrupos={asignacionesGrupos}
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
          gruposPredicacion={gruposPredicacion}
          horarios={horariosDisponibles}
          diasEspeciales={diasEspeciales}
          onPuntoChange={setPuntoId}
          onTerritorioToggle={handleTerritorioToggle}
          onCapitanChange={setCapitanId}
          onHorarioChange={setHorarioId}
          onEsDiaEspecialChange={handleEsDiaEspecialChange}
          onDiaEspecialChange={setDiaEspecialId}
          onEsPorGruposChange={handleEsPorGruposChange}
          onEsPorGrupoIndividualChange={handleEsPorGrupoIndividualChange}
          onAsignacionesSubmit={handleAsignacionesSubmit}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onDelete={handleDelete}
          isLoading={isLoading}
          submitLabel="Actualizar"
          showDelete
          showHorarioSelector={horariosDisponibles.length > 1}
          isEditing={true}
        />
      </DialogContent>
    </Dialog>
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
  esPorGrupos: boolean;
  esPorGrupoIndividual: boolean;
  asignacionesGrupos: AsignacionGrupo[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  gruposPredicacion: GrupoPredicacion[];
  horarios: HorarioSalida[];
  diasEspeciales: DiaEspecial[];
  onPuntoChange: (value: string) => void;
  onTerritorioToggle: (territorioId: string) => void;
  onCapitanChange: (value: string) => void;
  onHorarioChange: (value: string) => void;
  onEsDiaEspecialChange: (value: boolean) => void;
  onDiaEspecialChange: (value: string) => void;
  onEsPorGruposChange: (value: boolean) => void;
  onEsPorGrupoIndividualChange: (value: boolean) => void;
  onAsignacionesSubmit: (asignaciones: AsignacionGrupo[]) => void;
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
  esPorGrupos,
  esPorGrupoIndividual,
  asignacionesGrupos,
  puntos,
  territorios,
  participantes,
  gruposPredicacion,
  horarios,
  diasEspeciales,
  onPuntoChange,
  onTerritorioToggle,
  onCapitanChange,
  onHorarioChange,
  onEsDiaEspecialChange,
  onDiaEspecialChange,
  onEsPorGruposChange,
  onEsPorGrupoIndividualChange,
  onAsignacionesSubmit,
  onSubmit,
  onCancel,
  onDelete,
  isLoading,
  submitLabel,
  showDelete,
  showHorarioSelector,
  isEditing,
}: FormContentProps) {
  // Si está en modo por grupos de predicación, mostrar formulario de asignación completo
  if (esPorGrupos) {
    return (
      <div className="space-y-3">
        <div className="font-semibold text-sm border-b pb-2 flex items-center justify-between">
          <span className="font-bold">{title}</span>
          <div className="flex items-center gap-2">
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
        </div>

        {/* Toggle para volver al modo normal */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <Label className="text-xs font-medium text-primary">
              Predicación por grupos de predicación
            </Label>
          </div>
          <Switch
            checked={true}
            onCheckedChange={(checked) => {
              if (!checked) {
                onEsPorGruposChange(false);
              }
            }}
          />
        </div>

        <AsignacionGruposForm
          grupos={gruposPredicacion}
          territorios={territorios}
          participantes={participantes}
          asignacionesIniciales={asignacionesGrupos}
          onSubmit={onAsignacionesSubmit}
          onCancel={onCancel}
          isLoading={isLoading}
          submitLabel={submitLabel}
        />
      </div>
    );
  }

  // Si está en modo por grupo individual, mostrar formulario simple Grupo/Territorio
  if (esPorGrupoIndividual) {
    return (
      <div className="space-y-3">
        <div className="font-semibold text-sm border-b pb-2 flex items-center justify-between">
          <span className="font-bold">{title}</span>
          <div className="flex items-center gap-2">
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
        </div>

        {/* Toggle para volver al modo normal */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <Label className="text-xs font-medium text-primary">
              Predicación por grupo individual
            </Label>
          </div>
          <Switch
            checked={true}
            onCheckedChange={(checked) => {
              if (!checked) {
                onEsPorGrupoIndividualChange(false);
              }
            }}
          />
        </div>

        <AsignacionGrupoIndividualForm
          grupos={gruposPredicacion}
          territorios={territorios}
          asignacionesIniciales={asignacionesGrupos}
          onSubmit={onAsignacionesSubmit}
          onCancel={onCancel}
          isLoading={isLoading}
          submitLabel={submitLabel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="font-semibold text-sm border-b pb-2 flex items-center justify-between">
        <span className="font-bold">{title}</span>
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

      {/* Toggle para predicación por grupos de predicación */}
      {gruposPredicacion.length > 0 && !esDiaEspecial && (
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="por-grupos-toggle" className="text-xs font-medium">
              Predicación por grupos de predicación
            </Label>
          </div>
          <Switch
            id="por-grupos-toggle"
            checked={esPorGrupos}
            onCheckedChange={onEsPorGruposChange}
          />
        </div>
      )}

      {/* Toggle para predicación por grupo individual */}
      {gruposPredicacion.length > 0 && !esDiaEspecial && (
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="por-grupo-individual-toggle" className="text-xs font-medium">
              Predicación por grupo individual
            </Label>
          </div>
          <Switch
            id="por-grupo-individual-toggle"
            checked={esPorGrupoIndividual}
            onCheckedChange={onEsPorGrupoIndividualChange}
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
