import { useState } from "react";
import { Wand2, Settings2, Trash2, Plus, Loader2, Calendar } from "lucide-react";
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
import { useDisponibilidadCapitanes } from "@/hooks/useDisponibilidadCapitanes";
import { HorarioSalida, ProgramaConDetalles } from "@/types/programa-predicacion";
import { useToast } from "@/hooks/use-toast";
import { DisponibilidadCapitanesTab } from "./DisponibilidadCapitanesTab";

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

// Mapeo de restricciones a días de la semana (0=Domingo, 6=Sábado)
const RESTRICCIONES_DIAS: Record<string, number[]> = {
  sin_restriccion: [0, 1, 2, 3, 4, 5, 6],
  solo_fines_semana: [0, 6],
  solo_entre_semana: [1, 2, 3, 4, 5],
  solo_sabados: [6],
  solo_domingos: [0],
};

const getDiasPermitidos = (restriccion: string): number[] => {
  return RESTRICCIONES_DIAS[restriccion] || [0, 1, 2, 3, 4, 5, 6];
};

// Mapeo de días de texto a número
const DIAS_A_NUMERO: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

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
  onActualizarEntrada: (id: string, data: { capitan_id?: string }) => void;
  onCrearEntrada: (data: { fecha: string; horario_id: string; capitan_id?: string }) => void;
}

export function AsignacionCapitanesModal({
  horarios,
  programa,
  fechas,
  diasEspeciales = [],
  diasReunionConfig,
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

  const { estaDisponible, isLoading: isLoadingDisponibilidad } = useDisponibilidadCapitanes();

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

  // Función para verificar si un día/horario está bloqueado
  const esDiaBloqueado = (fecha: string, esManana: boolean): boolean => {
    const diaSemana = new Date(fecha + "T12:00:00").getDay();
    
    // Verificar si es día de reunión - BLOQUEA TODO EL DÍA (mañana y tarde)
    if (diasReunionConfig) {
      const diaEntreSemana = diasReunionConfig.dia_entre_semana?.toLowerCase();
      const diaFinSemana = diasReunionConfig.dia_fin_semana?.toLowerCase();
      
      const numeroDiaEntreSemana = diaEntreSemana ? DIAS_A_NUMERO[diaEntreSemana] : undefined;
      const numeroDiaFinSemana = diaFinSemana ? DIAS_A_NUMERO[diaFinSemana] : undefined;
      
      // Si es día de reunión entre semana, bloquea TODO el día (no solo la tarde)
      if (numeroDiaEntreSemana !== undefined && diaSemana === numeroDiaEntreSemana) {
        return true;
      }
      // Si es día de reunión fin de semana, bloquea TODO el día (no solo la mañana)
      if (numeroDiaFinSemana !== undefined && diaSemana === numeroDiaFinSemana) {
        return true;
      }
    }
    
    // Verificar si hay un mensaje especial bloqueante para esta fecha
    const entradaEspecial = programa.find(
      (p) => p.fecha === fecha && p.es_mensaje_especial
    );
    
    if (entradaEspecial) {
      // Si es colspan_completo, bloquea todo el día
      if (entradaEspecial.colspan_completo) {
        const diaEspecial = diasEspeciales.find((d) => d.nombre === entradaEspecial.mensaje_especial);
        const tipo = diaEspecial?.bloqueo_tipo ?? "completo";
        
        if (tipo === "completo") return true;
        if (tipo === "manana" && esManana) return true;
        if (tipo === "tarde" && !esManana) return true;
      } else if (entradaEspecial.horario_id) {
        // Verificar si el horario específico está bloqueado
        const horaHorario = horarios.find((h) => h.id === entradaEspecial.horario_id)?.hora;
        if (horaHorario) {
          const horaNum = parseInt(horaHorario.split(":")[0], 10);
          const esHorarioManana = horaNum < 12;
          if (esManana === esHorarioManana) return true;
        }
      }
    }
    
    return false;
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

    // Separar horarios en mañana y tarde, ordenados
    const horariosOrdenados = [...horarios].sort((a, b) => a.hora.localeCompare(b.hora));
    const horariosManana = horariosOrdenados.filter((h) => {
      const horaNum = parseInt(h.hora.split(":")[0], 10);
      return horaNum < 12;
    });
    const horariosTarde = horariosOrdenados.filter((h) => {
      const horaNum = parseInt(h.hora.split(":")[0], 10);
      return horaNum >= 12;
    });

    // Solo usar el primer horario de cada bloque (mañana + tarde)
    const primerHorarioManana = horariosManana[0];
    const primerHorarioTarde = horariosTarde[0];

    // Importante: procesar fechas en orden para que la rotación sea consecutiva
    const fechasOrdenadas = [...fechas].sort((a, b) => a.localeCompare(b));

    // Obtener IDs de capitanes que tienen asignaciones fijas (no participan de la rotación)
    const capitanesFijos = new Set(asignacionesFijas.map(a => a.capitan_id));
    
    // Lista de capitanes para rotación (sin los fijos) - ya vienen ordenados por apellido, nombre
    const capitanesParaRotacion = capitanesElegibles.filter(c => !capitanesFijos.has(c.id));
    
    // Índice de rotación simple - empieza en 0 y avanza secuencialmente
    let indiceRotacion = 0;
    const totalCapitanes = capitanesParaRotacion.length;

    try {
      for (const fecha of fechasOrdenadas) {
        // Registro de capitanes ya asignados hoy (para evitar repetir en el mismo día)
        const capitanesUsadosHoy = new Set<string>();
        const diaSemana = new Date(fecha + "T12:00:00").getDay();

        // Procesar horario de mañana
        if (primerHorarioManana) {
          const bloqueadoManana = esDiaBloqueado(fecha, true);
          
          if (!bloqueadoManana) {
            const entradaExistente = programa.find(
              (p) => p.fecha === fecha && p.horario_id === primerHorarioManana.id && !p.es_mensaje_especial
            );

            if (!entradaExistente?.capitan_id) {
              const asignacionFija = asignacionesFijas.find(
                (a) => a.dia_semana === diaSemana && a.horario_id === primerHorarioManana.id
              );

              let capitanId: string | null = null;

              if (asignacionFija) {
                capitanId = asignacionFija.capitan_id;
                // Asignación fija NO avanza el índice de rotación
              } else if (totalCapitanes > 0) {
                for (let i = 0; i < totalCapitanes; i++) {
                  const idx = (indiceRotacion + i) % totalCapitanes;
                  const candidato = capitanesParaRotacion[idx];
                  
                  const restriccion = candidato.restriccion_disponibilidad || "sin_restriccion";
                  const diasPermitidos = getDiasPermitidos(restriccion);
                  
                  // Verificar disponibilidad general + disponibilidad específica (tabla disponibilidad_capitanes)
                  const disponiblePorDia = diasPermitidos.includes(diaSemana);
                  const disponiblePorHorario = estaDisponible(candidato.id, diaSemana, true); // true = mañana
                  
                  if (disponiblePorDia && disponiblePorHorario && !capitanesUsadosHoy.has(candidato.id)) {
                    capitanId = candidato.id;
                    indiceRotacion = (idx + 1) % totalCapitanes;
                    break;
                  }
                }
              }

              if (capitanId) {
                capitanesUsadosHoy.add(capitanId);
                if (entradaExistente) {
                  onActualizarEntrada(entradaExistente.id, { capitan_id: capitanId });
                } else {
                  onCrearEntrada({ fecha, horario_id: primerHorarioManana.id, capitan_id: capitanId });
                }
                asignados++;
              }
            } else {
              capitanesUsadosHoy.add(entradaExistente.capitan_id);
            }
          }
          // Si está bloqueado, NO se avanza el índice de rotación
        }

        // Procesar horario de tarde
        if (primerHorarioTarde) {
          const bloqueadoTarde = esDiaBloqueado(fecha, false);
          
          if (!bloqueadoTarde) {
            const entradaExistente = programa.find(
              (p) => p.fecha === fecha && p.horario_id === primerHorarioTarde.id && !p.es_mensaje_especial
            );

            if (!entradaExistente?.capitan_id) {
              const asignacionFija = asignacionesFijas.find(
                (a) => a.dia_semana === diaSemana && a.horario_id === primerHorarioTarde.id
              );

              let capitanId: string | null = null;

              if (asignacionFija) {
                capitanId = asignacionFija.capitan_id;
                // Asignación fija NO avanza el índice de rotación
              } else if (totalCapitanes > 0) {
                for (let i = 0; i < totalCapitanes; i++) {
                  const idx = (indiceRotacion + i) % totalCapitanes;
                  const candidato = capitanesParaRotacion[idx];
                  
                  const restriccion = candidato.restriccion_disponibilidad || "sin_restriccion";
                  const diasPermitidos = getDiasPermitidos(restriccion);
                  
                  // Verificar disponibilidad general + disponibilidad específica (tabla disponibilidad_capitanes)
                  const disponiblePorDia = diasPermitidos.includes(diaSemana);
                  const disponiblePorHorario = estaDisponible(candidato.id, diaSemana, false); // false = tarde
                  
                  if (disponiblePorDia && disponiblePorHorario && !capitanesUsadosHoy.has(candidato.id)) {
                    capitanId = candidato.id;
                    indiceRotacion = (idx + 1) % totalCapitanes;
                    break;
                  }
                }
              }

              if (capitanId) {
                capitanesUsadosHoy.add(capitanId);
                if (entradaExistente) {
                  onActualizarEntrada(entradaExistente.id, { capitan_id: capitanId });
                } else {
                  onCrearEntrada({ fecha, horario_id: primerHorarioTarde.id, capitan_id: capitanId });
                }
                asignados++;
              }
            } else {
              capitanesUsadosHoy.add(entradaExistente.capitan_id);
            }
          }
          // Si está bloqueado, NO se avanza el índice de rotación
        }
      }

      toast({
        title: "Asignación completada",
        description: `Se asignaron ${asignados} capitanes automáticamente`,
      });
      
      // Cerrar el modal después de asignar
      setOpen(false);
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-600"
            onClick={() => setOpen(true)}
            aria-label="Asignación automática de capitanes"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Asignación Automática de Capitanes</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asignación Automática de Capitanes</DialogTitle>
          <DialogDescription>
            Configura asignaciones fijas o asigna capitanes automáticamente
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

          <TabsContent value="disponibilidad" className="mt-4">
            <DisponibilidadCapitanesTab capitanesElegibles={capitanesElegibles} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
