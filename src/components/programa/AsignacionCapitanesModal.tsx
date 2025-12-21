import { useState } from "react";
import { Wand2, Settings2, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

interface AsignacionCapitanesModalProps {
  horarios: HorarioSalida[];
  programa: ProgramaConDetalles[];
  fechas: string[];
  onActualizarEntrada: (id: string, data: { capitan_id?: string }) => void;
  onCrearEntrada: (data: { fecha: string; horario_id: string; capitan_id?: string }) => void;
}

export function AsignacionCapitanesModal({
  horarios,
  programa,
  fechas,
  onActualizarEntrada,
  onCrearEntrada,
}: AsignacionCapitanesModalProps) {
  const [open, setOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();

  const {
    asignacionesFijas,
    capitanesElegibles,
    isLoading,
    crearAsignacionFija,
    eliminarAsignacionFija,
    obtenerCapitanDisponible,
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
    if (isLoading) {
      toast({
        title: "Espera a que carguen los datos",
        description: "Cargando asignaciones fijas y capitanes elegibles…",
        variant: "destructive",
      });
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
    let asignados = 0;

    // Estado local de rotación para esta corrida
    const estadoRotacion = new Map<string, number>();

    try {
      for (const fecha of fechas) {
        for (const horario of horarios) {
          // Buscar entrada existente para esta fecha/horario
          const entradaExistente = programa.find(
            (p) => p.fecha === fecha && p.horario_id === horario.id && !p.es_mensaje_especial
          );

          // Si ya tiene capitán, no modificar
          if (entradaExistente?.capitan_id) continue;

          // Obtener capitán disponible (prioriza asignaciones fijas)
          const capitanId = obtenerCapitanDisponible(
            fecha,
            horario.id,
            asignacionesFijas,
            capitanesElegibles,
            { estrategia: "rotacion", estadoRotacion }
          );

          if (!capitanId) continue;

          if (entradaExistente) {
            // Actualizar entrada existente
            onActualizarEntrada(entradaExistente.id, { capitan_id: capitanId });
            asignados++;
          } else {
            // Crear nueva entrada solo con capitán
            onCrearEntrada({
              fecha,
              horario_id: horario.id,
              capitan_id: capitanId,
            });
            asignados++;
          }
        }
      }

      toast({
        title: "Asignación completada",
        description: `Se asignaron ${asignados} capitanes automáticamente`,
      });
    } catch (error) {
      toast({
        title: "Error en asignación",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Wand2 className="h-4 w-4 mr-2" />
          Capitanes Auto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asignación Automática de Capitanes</DialogTitle>
          <DialogDescription>
            Configura asignaciones fijas o asigna capitanes automáticamente
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="asignar" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="asignar">Asignar Ahora</TabsTrigger>
            <TabsTrigger value="configurar">
              <Settings2 className="h-4 w-4 mr-2" />
              Asignaciones Fijas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="asignar" className="space-y-4 mt-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium">¿Cómo funciona?</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Solo se asignan celdas <strong>sin capitán</strong></li>
                <li>Las asignaciones manuales existentes se respetan</li>
                <li>Primero se usan las asignaciones fijas (día + horario + hora)</li>
                <li>Luego se asigna por rotación entre capitanes disponibles</li>
              </ul>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Capitanes elegibles</p>
                <p className="text-sm text-muted-foreground">
                  {capitanesElegibles.length} participante(s) con "Es capitán" activado
                </p>
              </div>
              <Button 
                onClick={handleAsignarAutomaticamente}
                disabled={isAssigning || isLoading || capitanesElegibles.length === 0}
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Asignando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Asignar Capitanes
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
                        disabled={eliminarAsignacionFija.isPending}
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
                disabled={crearAsignacionFija.isPending || !nuevaAsignacion.dia_semana || !nuevaAsignacion.horario_id || !nuevaAsignacion.capitan_id}
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
