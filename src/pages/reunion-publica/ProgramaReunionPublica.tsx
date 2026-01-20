import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, getDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Save, Loader2 } from "lucide-react";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useCongregacion } from "@/contexts/CongregacionContext";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function ProgramaReunionPublica() {
  const { congregacionActual } = useCongregacion();
  const [mes, setMes] = useState(new Date().getMonth());
  const [anio, setAnio] = useState(new Date().getFullYear());
  
  const { programa, conductores, lectoresElegibles, isLoading, guardarPrograma } = useReunionPublica(mes, anio);
  const { participantes } = useParticipantes();
  const { configuraciones } = useConfiguracionSistema("general");

  // Obtener día de la reunión pública desde configuración
  const diaReunionConfig = configuraciones?.find(c => c.clave === "dia_reunion_publica");
  const diaReunion = (diaReunionConfig?.valor as { dia?: number })?.dia ?? 0; // 0 = Domingo por defecto

  // Filtrar solo A (Ancianos) y SM (Siervos Ministeriales)
  const participantesElegibles = useMemo(() => {
    return participantes?.filter(p => 
      p.responsabilidad?.some(r => r === "anciano" || r === "siervo_ministerial")
    ) || [];
  }, [participantes]);

  // Obtener solo los 3 conductores configurados
  const conductoresIds = conductores?.map(c => c.participante_id) || [];
  const participantesConductor = participantesElegibles.filter(p => 
    conductoresIds.includes(p.id)
  );

  // Obtener lectores elegibles con datos
  const lectoresElegiblesIds = lectoresElegibles?.map(l => l.participante_id) || [];
  const participantesLector = participantes?.filter(p => 
    lectoresElegiblesIds.includes(p.id)
  ) || [];

  // Calcular fechas del mes según el día de reunión
  const fechasReunion = useMemo(() => {
    const inicio = startOfMonth(new Date(anio, mes));
    const fin = endOfMonth(new Date(anio, mes));
    
    const semanas = eachWeekOfInterval({ start: inicio, end: fin }, { weekStartsOn: 1 });
    
    return semanas
      .map(semana => {
        // Encontrar el día de la reunión en esa semana
        const diff = (diaReunion - getDay(semana) + 7) % 7;
        return addDays(semana, diff);
      })
      .filter(fecha => fecha >= inicio && fecha <= fin);
  }, [mes, anio, diaReunion]);

  // Estado local para edición
  const [editingData, setEditingData] = useState<Record<string, any>>({});

  const handleCambioMes = (direccion: number) => {
    const nuevoMes = mes + direccion;
    if (nuevoMes < 0) {
      setMes(11);
      setAnio(anio - 1);
    } else if (nuevoMes > 11) {
      setMes(0);
      setAnio(anio + 1);
    } else {
      setMes(nuevoMes);
    }
  };

  const getValorProgramado = (fecha: string, campo: string) => {
    // Primero buscar en editingData
    if (editingData[fecha]?.[campo] !== undefined) {
      return editingData[fecha][campo];
    }
    // Luego buscar en programa guardado
    const programaFecha = programa?.find(p => p.fecha === fecha);
    return programaFecha?.[campo as keyof typeof programaFecha] || "";
  };

  const handleCambio = (fecha: string, campo: string, valor: string) => {
    setEditingData(prev => ({
      ...prev,
      [fecha]: {
        ...prev[fecha],
        [campo]: valor || null,
      }
    }));
  };

  const handleGuardar = async (fecha: string) => {
    const datos = editingData[fecha];
    if (!datos) return;

    await guardarPrograma.mutateAsync({
      fecha,
      ...datos,
    });

    // Limpiar datos de edición para esa fecha
    setEditingData(prev => {
      const { [fecha]: _, ...rest } = prev;
      return rest;
    });
  };

  const tieneEdiciones = (fecha: string) => {
    return Object.keys(editingData[fecha] || {}).length > 0;
  };

  const getParticipanteNombre = (id: string | null) => {
    if (!id) return "";
    const p = participantes?.find(p => p.id === id);
    return p ? `${p.nombre} ${p.apellido}` : "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programa Reunión Pública</h1>
      </div>

      {/* Selector de mes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => handleCambioMes(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">
              {MESES[mes]} {anio}
            </CardTitle>
            <Button variant="outline" size="icon" onClick={() => handleCambioMes(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Layout reorganizado: fechas en columnas horizontales */}
      <div className="grid gap-4">
        {/* Header con fechas */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-sm w-[180px] sticky left-0 bg-muted/50">
                      Asignación
                    </th>
                    {fechasReunion.map((fecha) => (
                      <th key={format(fecha, "yyyy-MM-dd")} className="text-center p-3 font-medium text-sm min-w-[160px]">
                        {format(fecha, "d 'de' MMMM", { locale: es })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Presidente */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">
                      Presidente
                    </td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Select
                            value={getValorProgramado(fechaStr, "presidente_id") || ""}
                            onValueChange={(v) => handleCambio(fechaStr, "presidente_id", v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {participantesElegibles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre} {p.apellido}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Tema del Discurso */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">
                      Tema del Discurso
                    </td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Input
                            value={getValorProgramado(fechaStr, "tema_discurso") || ""}
                            onChange={(e) => handleCambio(fechaStr, "tema_discurso", e.target.value)}
                            placeholder="Tema..."
                            className="w-full"
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Orador (campo libre) */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">
                      Orador
                    </td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Input
                            value={getValorProgramado(fechaStr, "orador_nombre") || ""}
                            onChange={(e) => handleCambio(fechaStr, "orador_nombre", e.target.value)}
                            placeholder="Nombre del orador..."
                            className="w-full"
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Orador Suplente */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">
                      Orador Suplente
                    </td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Select
                            value={getValorProgramado(fechaStr, "orador_suplente_id") || ""}
                            onValueChange={(v) => handleCambio(fechaStr, "orador_suplente_id", v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {participantesElegibles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre} {p.apellido}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Orador Saliente */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">
                      Orador Saliente
                    </td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Select
                            value={getValorProgramado(fechaStr, "orador_saliente_id") || ""}
                            onValueChange={(v) => handleCambio(fechaStr, "orador_saliente_id", v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {participantesElegibles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre} {p.apellido}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Conductor Atalaya */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">
                      Conductor Atalaya
                    </td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Select
                            value={getValorProgramado(fechaStr, "conductor_atalaya_id") || ""}
                            onValueChange={(v) => handleCambio(fechaStr, "conductor_atalaya_id", v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {participantesConductor.length > 0 ? (
                                participantesConductor.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nombre} {p.apellido}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="_none" disabled>
                                  Configure conductores en Ajustes
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Lector Atalaya */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">
                      Lector Atalaya
                    </td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Select
                            value={getValorProgramado(fechaStr, "lector_atalaya_id") || ""}
                            onValueChange={(v) => handleCambio(fechaStr, "lector_atalaya_id", v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {participantesLector.length > 0 ? (
                                participantesLector.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nombre} {p.apellido}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="_none" disabled>
                                  Configure lectores elegibles
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila de acciones (guardar) */}
                  <tr>
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background"></td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2 text-center">
                          {tieneEdiciones(fechaStr) && (
                            <Button
                              size="sm"
                              onClick={() => handleGuardar(fechaStr)}
                              disabled={guardarPrograma.isPending}
                              className="w-full"
                            >
                              {guardarPrograma.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Save className="h-4 w-4 mr-1" />
                              )}
                              Guardar
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
