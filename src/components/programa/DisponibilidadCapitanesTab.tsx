import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useDisponibilidadCapitanes } from "@/hooks/useDisponibilidadCapitanes";
import { useToast } from "@/hooks/use-toast";

const DIAS_SEMANA = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const BLOQUES = [
  { value: "manana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
  { value: "ambos", label: "Ambos" },
];

interface Participante {
  id: string;
  nombre: string;
  apellido: string;
}

interface DisponibilidadCapitanesTabProps {
  capitanesElegibles: Participante[];
}

interface DisponibilidadLocal {
  dia_semana: number;
  bloque_horario: "manana" | "tarde" | "ambos";
}

export function DisponibilidadCapitanesTab({ capitanesElegibles }: DisponibilidadCapitanesTabProps) {
  const { toast } = useToast();
  const {
    disponibilidades,
    isLoading,
    obtenerDisponibilidadCapitan,
    guardarDisponibilidadCompleta,
  } = useDisponibilidadCapitanes();

  const [capitanSeleccionado, setCapitanSeleccionado] = useState<string>("");
  const [disponibilidadLocal, setDisponibilidadLocal] = useState<DisponibilidadLocal[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar disponibilidad cuando se selecciona un capitán
  const handleSelectCapitan = (capitanId: string) => {
    setCapitanSeleccionado(capitanId);
    const disponibilidadesCapitan = obtenerDisponibilidadCapitan(capitanId);
    setDisponibilidadLocal(
      disponibilidadesCapitan.map(d => ({
        dia_semana: d.dia_semana,
        bloque_horario: d.bloque_horario,
      }))
    );
    setHasChanges(false);
  };

  // Verificar si un día está habilitado
  const isDiaHabilitado = (dia: number) => {
    return disponibilidadLocal.some(d => d.dia_semana === dia);
  };

  // Obtener bloque de un día
  const getBloqueForDia = (dia: number): "manana" | "tarde" | "ambos" | null => {
    const disp = disponibilidadLocal.find(d => d.dia_semana === dia);
    return disp?.bloque_horario ?? null;
  };

  // Toggle día
  const toggleDia = (dia: number) => {
    setHasChanges(true);
    if (isDiaHabilitado(dia)) {
      setDisponibilidadLocal(prev => prev.filter(d => d.dia_semana !== dia));
    } else {
      setDisponibilidadLocal(prev => [...prev, { dia_semana: dia, bloque_horario: "ambos" }]);
    }
  };

  // Cambiar bloque de un día
  const cambiarBloque = (dia: number, bloque: "manana" | "tarde" | "ambos") => {
    setHasChanges(true);
    setDisponibilidadLocal(prev =>
      prev.map(d => (d.dia_semana === dia ? { ...d, bloque_horario: bloque } : d))
    );
  };

  // Guardar cambios
  const handleGuardar = async () => {
    if (!capitanSeleccionado) return;

    try {
      await guardarDisponibilidadCompleta.mutateAsync({
        capitanId: capitanSeleccionado,
        disponibilidades: disponibilidadLocal,
      });
      toast({ title: "Disponibilidad guardada correctamente" });
      setHasChanges(false);
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    }
  };

  // Verificar si un capitán tiene disponibilidad configurada
  const tieneDisponibilidad = (capitanId: string) => {
    return disponibilidades.some(d => d.capitan_id === capitanId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Define los días y horarios en que cada capitán está disponible. 
          Los capitanes <strong>sin configuración</strong> se consideran disponibles todos los días.
        </p>
      </div>

      {/* Selector de capitán */}
      <div className="space-y-2">
        <Label>Selecciona un capitán</Label>
        <Select value={capitanSeleccionado} onValueChange={handleSelectCapitan}>
          <SelectTrigger>
            <SelectValue placeholder="Elegir capitán..." />
          </SelectTrigger>
          <SelectContent>
            {capitanesElegibles.map((cap) => (
              <SelectItem key={cap.id} value={cap.id}>
                <span className="flex items-center gap-2">
                  {cap.apellido}, {cap.nombre}
                  {tieneDisponibilidad(cap.id) && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      Configurado
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Configuración de días */}
      {capitanSeleccionado && (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Día</th>
                  <th className="text-center p-3 font-medium">Disponible</th>
                  <th className="text-left p-3 font-medium">Horario</th>
                </tr>
              </thead>
              <tbody>
                {DIAS_SEMANA.map((dia) => {
                  const habilitado = isDiaHabilitado(dia.value);
                  const bloque = getBloqueForDia(dia.value);

                  return (
                    <tr key={dia.value} className="border-t">
                      <td className="p-3 font-medium">{dia.label}</td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={habilitado}
                          onCheckedChange={() => toggleDia(dia.value)}
                        />
                      </td>
                      <td className="p-3">
                        {habilitado ? (
                          <Select
                            value={bloque || "ambos"}
                            onValueChange={(val) =>
                              cambiarBloque(dia.value, val as "manana" | "tarde" | "ambos")
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BLOQUES.map((b) => (
                                <SelectItem key={b.value} value={b.value}>
                                  {b.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumen */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
            <div className="text-sm">
              {disponibilidadLocal.length === 0 ? (
                <span className="text-amber-600">
                  Sin días seleccionados = Disponible siempre
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {disponibilidadLocal.length} día(s) configurado(s)
                </span>
              )}
            </div>
            <Button
              onClick={handleGuardar}
              disabled={!hasChanges || guardarDisponibilidadCompleta.isPending}
            >
              {guardarDisponibilidadCompleta.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de capitanes con disponibilidad configurada */}
      {!capitanSeleccionado && disponibilidades.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Capitanes con disponibilidad configurada</h4>
          <div className="space-y-2">
            {/* Agrupar por capitán */}
            {Array.from(new Set(disponibilidades.map(d => d.capitan_id))).map(capitanId => {
              const disponibilidadesCapitan = disponibilidades.filter(d => d.capitan_id === capitanId);
              const capitan = disponibilidadesCapitan[0]?.capitan;
              if (!capitan) return null;

              return (
                <div
                  key={capitanId}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectCapitan(capitanId)}
                >
                  <div className="font-medium">
                    {capitan.apellido}, {capitan.nombre}
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-2 mt-1">
                    {disponibilidadesCapitan.map(d => {
                      const dia = DIAS_SEMANA.find(dia => dia.value === d.dia_semana);
                      const bloqueLabel = d.bloque_horario === "ambos" 
                        ? "" 
                        : d.bloque_horario === "manana" 
                          ? " (mañana)" 
                          : " (tarde)";
                      return (
                        <span key={d.id} className="bg-muted px-2 py-0.5 rounded text-xs">
                          {dia?.label}{bloqueLabel}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
