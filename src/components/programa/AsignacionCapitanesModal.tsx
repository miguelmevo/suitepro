import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wand2, Settings2, Trash2, Plus, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useIaUsoMensual, useInvalidarIaUsoMensual } from "@/hooks/useIaUsoMensual";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsignacionCapitanes, AsignacionFija } from "@/hooks/useAsignacionCapitanes";
import { HorarioSalida, ProgramaConDetalles } from "@/types/programa-predicacion";
import { useToast } from "@/hooks/use-toast";
import { DisponibilidadCapitanesTab } from "./DisponibilidadCapitanesTab";
import { GeneracionAutomaticaOverlay } from "@/components/ui/GeneracionAutomaticaOverlay";

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

interface DiaEspecialInfo {
  id: string;
  nombre: string;
  bloqueo_tipo: "completo" | "manana" | "tarde";
  fecha?: string | null;
}

interface DiasReunionConfig {
  dia_entre_semana?: string;
  hora_entre_semana?: string;
  dia_fin_semana?: string;
  hora_fin_semana?: string;
}

interface AsignacionCapitanesModalProps {
  horarios: HorarioSalida[];
  programa: ProgramaConDetalles[];
  fechas: string[];
  diasEspeciales?: DiaEspecialInfo[];
  diasReunionConfig?: DiasReunionConfig;
  canManageCapitanes?: boolean;
  congregacionId?: string | null;
  anio?: number;
  mes?: number;
  onActualizarEntrada: (id: string, data: { capitan_id?: string }) => void;
  onCrearEntrada: (data: { fecha: string; horario_id: string; capitan_id?: string }) => void;
}

export function AsignacionCapitanesModal({
  horarios,
  programa,
  fechas,
  diasEspeciales = [],
  diasReunionConfig,
  canManageCapitanes = true,
  congregacionId = null,
  anio,
  mes,
  onActualizarEntrada,
  onCrearEntrada,
}: AsignacionCapitanesModalProps) {
  const [open, setOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const { usos: iaUsos, limite: iaLimite, agotado: iaAgotado } = useIaUsoMensual(congregacionId, user?.email);
  const invalidarIaUso = useInvalidarIaUsoMensual();

  const {
    asignacionesFijas,
    capitanesElegibles,
    isLoading,
    crearAsignacionFija,
    eliminarAsignacionFija,
  } = useAsignacionCapitanes();

  // Estado para nueva asignación fija
  const [nuevaAsignacion, setNuevaAsignacion] = useState({
    dia_semana: "",
    horario_id: "",
    capitan_id: "",
  });

  const handleCrearAsignacionFija = () => {
    if (!nuevaAsignacion.dia_semana || !nuevaAsignacion.horario_id || !nuevaAsignacion.capitan_id) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }

    crearAsignacionFija.mutate({
      dia_semana: parseInt(nuevaAsignacion.dia_semana),
      horario_id: nuevaAsignacion.horario_id,
      capitan_id: nuevaAsignacion.capitan_id,
    });

    setNuevaAsignacion({ dia_semana: "", horario_id: "", capitan_id: "" });
  };

  const handleAsignarAutomaticamente = async () => {
    if (!congregacionId || anio === undefined || mes === undefined) {
      toast({ title: "Falta información de la congregación/mes", variant: "destructive" });
      return;
    }
    if (capitanesElegibles.length === 0) {
      toast({
        title: "No hay capitanes elegibles",
        description: "Marca participantes como capitanes en la pantalla de Participantes",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);
    try {
      const { data, error } = await supabase.functions.invoke("asignar-predicacion-ia", {
        body: { congregacion_id: congregacionId, anio, mes },
      });
      if (error) {
        let detalle: string | undefined;
        try {
          const errBody = await (error as any)?.context?.json?.();
          detalle = errBody?.message || errBody?.error;
        } catch {
          // el cuerpo puede no ser JSON o ya haber sido consumido
        }
        throw new Error(detalle || error.message);
      }
      if ((data as any)?.error) {
        throw new Error((data as any).error === "ia_limit_reached" ? (data as any).message : (data as any).error);
      }
      queryClient.invalidateQueries({ queryKey: ["programa-predicacion"] });
      invalidarIaUso(congregacionId);
      toast({ title: "Programa generado con IA", description: "Se asignaron capitán, territorio y punto de encuentro donde faltaban." });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error en asignación con IA",
        description: error?.message || "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <>
      <GeneracionAutomaticaOverlay open={isAssigning} mensaje="Asignando capitanes con IA…" />
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-600"
            onClick={() => setOpen(true)}
            disabled={!canManageCapitanes}
            aria-label="Asignar con IA"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Asignar con IA (capitán, territorio y punto de encuentro)</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asignación con IA</DialogTitle>
          <DialogDescription>
            Configura asignaciones fijas o deja que la IA complete capitán, territorio y punto de encuentro
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="asignar" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="asignar">Asignar Ahora</TabsTrigger>
            <TabsTrigger value="configurar">
              <Settings2 className="h-4 w-4 mr-2" />
              Asignaciones Fijas
            </TabsTrigger>
            <TabsTrigger value="disponibilidad">
              <Calendar className="h-4 w-4 mr-2" />
              Disponibilidad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="asignar" className="space-y-4 mt-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium">¿Cómo funciona?</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>La IA completa capitán, territorio y punto de encuentro donde <strong>falten</strong></li>
                <li>Las asignaciones manuales existentes se respetan</li>
                <li>Primero se usan las asignaciones fijas (día + horario + hora)</li>
                <li>Respeta disponibilidad, indisponibilidad puntual y días especiales</li>
                <li>No cubre entradas "por grupos" (esas se configuran a mano)</li>
              </ul>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Capitanes elegibles</p>
                <p className="text-sm text-muted-foreground">
                  {capitanesElegibles.length} participante(s) con "Es capitán" activado
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {iaAgotado ? `Se agotaron los ${iaLimite} usos de IA de este mes` : `${iaUsos}/${iaLimite} usos de IA este mes`}
                </p>
              </div>
              <Button
                onClick={handleAsignarAutomaticamente}
                disabled={!canManageCapitanes || isAssigning || isLoading || capitanesElegibles.length === 0 || iaAgotado}
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Asignando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Asignar con IA
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="configurar" className="space-y-4 mt-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Define capitanes fijos para combinaciones específicas de día y horario.
                Estas asignaciones tienen prioridad sobre la selección aleatoria.
              </p>
            </div>

            {/* Lista de asignaciones fijas existentes */}
            {asignacionesFijas.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Asignaciones configuradas</h4>
                <div className="space-y-2">
                  {asignacionesFijas.map((asig) => (
                    <div 
                      key={asig.id} 
                      className="flex items-center justify-between p-3 bg-background border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-medium">
                          {DIAS_SEMANA.find(d => d.value === asig.dia_semana)?.label}
                        </span>
                        <span className="text-muted-foreground">
                          {asig.horario?.nombre || "Sin horario"}
                          {asig.horario?.hora ? ` (${asig.horario.hora.slice(0, 5)})` : ""}
                        </span>
                        <span className="text-primary">
                          → {asig.capitan?.apellido}, {asig.capitan?.nombre}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => eliminarAsignacionFija.mutate(asig.id)}
                        disabled={!canManageCapitanes || eliminarAsignacionFija.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulario para nueva asignación fija */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium text-sm">Nueva asignación fija</h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Día</Label>
                  <Select
                    value={nuevaAsignacion.dia_semana}
                    onValueChange={(v) => setNuevaAsignacion(prev => ({ ...prev, dia_semana: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar día" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.value} value={String(dia.value)}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Horario</Label>
                  <Select
                    value={nuevaAsignacion.horario_id}
                    onValueChange={(v) => setNuevaAsignacion(prev => ({ ...prev, horario_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar horario" />
                    </SelectTrigger>
                    <SelectContent>
                      {horarios.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.nombre} ({h.hora.slice(0, 5)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Capitán</Label>
                  <Select
                    value={nuevaAsignacion.capitan_id}
                    onValueChange={(v) => setNuevaAsignacion(prev => ({ ...prev, capitan_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar capitán" />
                    </SelectTrigger>
                    <SelectContent>
                      {capitanesElegibles.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.apellido}, {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleCrearAsignacionFija}
                disabled={!canManageCapitanes || crearAsignacionFija.isPending || !nuevaAsignacion.dia_semana || !nuevaAsignacion.horario_id || !nuevaAsignacion.capitan_id}
                className="w-full"
              >
                {crearAsignacionFija.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Agregar Asignación Fija
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="disponibilidad" className="mt-4">
            <DisponibilidadCapitanesTab capitanesElegibles={capitanesElegibles} readOnly={!canManageCapitanes} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    </>
  );
}
