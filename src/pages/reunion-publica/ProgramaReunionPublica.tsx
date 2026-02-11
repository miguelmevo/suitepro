import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, getDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Loader2, Check, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { ImpresionReunionPublica } from "@/components/reunion-publica/ImpresionReunionPublica";
import { useReactToPrint } from "react-to-print";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DIA_SEMANA_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export default function ProgramaReunionPublica() {
  const { congregacionActual } = useCongregacion();
  const [mes, setMes] = useState(new Date().getMonth());
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  
  const { programa, conductores, lectoresElegibles, isLoading, guardarPrograma } = useReunionPublica(mes, anio);
  const { participantes } = useParticipantes();
  const { configuraciones } = useConfiguracionSistema("general");

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Programa Reunión Pública - ${MESES[mes]} ${anio}`,
  });

  // Obtener día de la reunión pública desde configuración general
  const diasReunionConfig = configuraciones?.find(c => c.clave === "dias_reunion");
  const diaFinSemanaStr = (diasReunionConfig?.valor as { dia_fin_semana?: string })?.dia_fin_semana ?? "domingo";
  const diaReunion = DIA_SEMANA_MAP[diaFinSemanaStr] ?? 0;

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
        const diff = (diaReunion - getDay(semana) + 7) % 7;
        return addDays(semana, diff);
      })
      .filter(fecha => fecha >= inicio && fecha <= fin);
  }, [mes, anio, diaReunion]);

  // Estado local para edición
  const [editingData, setEditingData] = useState<Record<string, any>>({});
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save: guardar todas las fechas pendientes
  const guardarTodosLosPendientes = useCallback(async () => {
    const fechasPendientes = Object.keys(editingData).filter(f => Object.keys(editingData[f] || {}).length > 0);
    if (fechasPendientes.length === 0) return;

    setSavingStatus("saving");
    try {
      for (const fecha of fechasPendientes) {
        await guardarPrograma.mutateAsync({
          fecha,
          ...editingData[fecha],
        });
      }
      setEditingData({});
      setSavingStatus("saved");
      setTimeout(() => setSavingStatus("idle"), 2000);
    } catch {
      setSavingStatus("idle");
    }
  }, [editingData, guardarPrograma]);

  // Debounce auto-save on editingData changes
  useEffect(() => {
    const hasPending = Object.keys(editingData).some(f => Object.keys(editingData[f] || {}).length > 0);
    if (!hasPending) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      guardarTodosLosPendientes();
    }, 3000);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [editingData, guardarTodosLosPendientes]);

  const handleCambioMes = (direccion: number) => {
    guardarTodosLosPendientes();
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
    if (editingData[fecha]?.[campo] !== undefined) {
      return editingData[fecha][campo];
    }
    const programaFecha = programa?.find(p => p.fecha === fecha);
    return programaFecha?.[campo as keyof typeof programaFecha] || "";
  };

  const handleCambio = (fecha: string, campo: string, valor: string) => {
    setEditingData(prev => ({
      ...prev,
      [fecha]: {
        ...prev[fecha],
        [campo]: valor === "__none__" ? null : (valor || null),
      }
    }));
  };

  const colorTema = congregacionActual?.color_primario || "blue";
  const mesAnio = `${MESES[mes]} ${anio}`;

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
        <div className="flex items-center gap-3">
          {savingStatus === "saving" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Guardando...
            </div>
          )}
          {savingStatus === "saved" && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Check className="h-3 w-3" />
              Guardado
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrintPreview(true)}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Vista Previa / PDF
          </Button>
        </div>
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

      {/* Layout: fechas en columnas horizontales */}
      <div className="grid gap-4">
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
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Presidente</td>
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
                              <SelectItem value="__none__">— Sin asignar —</SelectItem>
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
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Tema del Discurso</td>
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
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Orador</td>
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

                  {/* Congregación del Orador */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Congregación Orador</td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Input
                            value={getValorProgramado(fechaStr, "orador_congregacion") || ""}
                            onChange={(e) => handleCambio(fechaStr, "orador_congregacion", e.target.value)}
                            placeholder="Congregación..."
                            className="w-full"
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Orador Suplente */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Orador Suplente</td>
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
                              <SelectItem value="__none__">— Sin asignar —</SelectItem>
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
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Orador Saliente</td>
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
                              <SelectItem value="__none__">— Sin asignar —</SelectItem>
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
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Conductor Atalaya</td>
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
                              <SelectItem value="__none__">— Sin asignar —</SelectItem>
                              {participantesConductor.length > 0 ? (
                                participantesConductor.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nombre} {p.apellido}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="_none_disabled" disabled>
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
                  <tr>
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Lector Atalaya</td>
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
                              <SelectItem value="__none__">— Sin asignar —</SelectItem>
                              {participantesLector.length > 0 ? (
                                participantesLector.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nombre} {p.apellido}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="_none_disabled" disabled>
                                  Configure lectores elegibles
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
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

      {/* Modal de Vista Previa / Impresión */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Vista Previa - {MESES[mes]} {anio}</span>
              <Button size="sm" onClick={() => handlePrint()}>
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimir / PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          <ImpresionReunionPublica
            ref={printRef}
            programa={programa || []}
            participantes={participantes || []}
            fechas={fechasReunion}
            congregacionNombre={congregacionActual?.nombre || ""}
            mesAnio={mesAnio}
            colorTema={colorTema}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
