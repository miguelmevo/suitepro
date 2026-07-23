import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, getDay, addDays, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Loader2, Printer, Upload, Share2, Lock, Eye, Eraser, Ban } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useReunionPublica, useProgramasReunionPublicaTodos } from "@/hooks/useReunionPublica";
import { ParticipanteSelectorRP } from "@/components/reunion-publica/ParticipanteSelectorRP";
import { computeUltimasParticipacionesRP } from "@/lib/reunion-publica-historial";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { usePermisos } from "@/hooks/usePermisos";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useAuthContext } from "@/contexts/AuthProvider";
import { ImpresionReunionPublica } from "@/components/reunion-publica/ImpresionReunionPublica";
import { useProgramasPublicados } from "@/hooks/useProgramasPublicados";
import { useProgramaBloqueado } from "@/hooks/useProgramaBloqueado";
import { useReactToPrint } from "react-to-print";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProgramaPdfSignedUrl } from "@/lib/programaPdfUrl";
import { CierreProgramaModal } from "@/components/programa/CierreProgramaModal";
import { SelectorMesPopover } from "@/components/programa/SelectorMesPopover";

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
  const mesSiguiente = addMonths(new Date(), 1);
  const [mes, setMes] = useState(mesSiguiente.getMonth());
  const [anio, setAnio] = useState(mesSiguiente.getFullYear());
  const mesActualReal = new Date().getMonth();
  const anioActualReal = new Date().getFullYear();
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [limpiarOpen, setLimpiarOpen] = useState(false);
  const [isLimpiando, setIsLimpiando] = useState(false);
  const queryClient = useQueryClient();
  
  const { programa, conductores, lectoresElegibles, isLoading, guardarPrograma } = useReunionPublica(mes, anio);
  const { data: programasHistorial } = useProgramasReunionPublicaTodos();
  const ultimasMapRP = useMemo(
    () => computeUltimasParticipacionesRP(programasHistorial),
    [programasHistorial]
  );
  const { participantes, todosParticipantes } = useParticipantes();
  const { configuraciones } = useConfiguracionSistema("general");
  const { configuraciones: configsRP } = useConfiguracionSistema("reunion_publica");
  const { publicarPrograma, eliminarPrograma, cerrarPrograma, reabrirPrograma, buscarProgramaPorPeriodo } = useProgramasPublicados("reunion_publica");

  // Permisos granulares
  const { canCreate, canEdit, canView } = usePermisos();
  const puedeEditar = canEdit("reunion_publica_programa");
  const puedeCrear = canCreate("reunion_publica_programa");
  const puedeCerrarReunionPublica = canView("cierre_reunion_publica");
  const { roles, getRoleInCongregacion } = useAuthContext();
  const isSuperAdmin = roles.includes("super_admin");
  const rolEnCong = congregacionActual?.id ? getRoleInCongregacion(congregacionActual.id) : null;
  const puedeCerrarAbrir = isSuperAdmin || rolEnCong === "admin" || puedeCerrarReunionPublica;
  const { bloqueado: bloqueadoPorFecha } = useProgramaBloqueado(new Date(anio, mes, 1), "reunion_publica", isSuperAdmin, configsRP);

  const printRef = useRef<HTMLDivElement>(null);
  const publishRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Programa Reunión Pública - ${MESES[mes]} ${anio}`,
  });

  const fechaInicioMes = format(startOfMonth(new Date(anio, mes)), "yyyy-MM-dd");
  const fechaFinMes = format(endOfMonth(new Date(anio, mes)), "yyyy-MM-dd");
  const periodoLabel = `${MESES[mes]} ${anio}`.toLowerCase();
  const programaPublicadoExistente = buscarProgramaPorPeriodo("reunion_publica", fechaInicioMes, fechaFinMes);
  const estaCerrado = programaPublicadoExistente?.cerrado ?? false;
  // Cuando el programa está cerrado manualmente nadie puede editar — ni admin ni
  // super_admin — deben reabrirlo primero desde el candado (puedeCerrarAbrir).
  const isReadOnly = (!puedeEditar && !puedeCrear) || estaCerrado || (bloqueadoPorFecha && !isSuperAdmin);

  // Si el programa se modificó después de la última publicación, hay cambios sin
  // publicar y el botón "Publicar" debe reaparecer.
  const hayCambiosSinPublicar = useMemo(() => {
    if (!programaPublicadoExistente) return false;
    const fechaPublicacion = new Date(programaPublicadoExistente.updated_at).getTime();
    return (programa ?? []).some(
      (p: any) => p.updated_at && new Date(p.updated_at).getTime() > fechaPublicacion
    );
  }, [programaPublicadoExistente, programa]);
  const mostrarPublicar = !programaPublicadoExistente || hayCambiosSinPublicar;
  const mostrarDespublicar = !!programaPublicadoExistente;

  const handlePublicar = async () => {
    if (!publishRef.current) return;
    setIsPublishing(true);
    try {
      const canvas = await html2canvas(publishRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.98),
        "JPEG",
        margin, margin,
        contentWidth,
        Math.min(imgHeight, contentHeight)
      );

      const pdfBlob = pdf.output("blob");
      await publicarPrograma.mutateAsync({
        tipoProgramaId: "reunion_publica",
        periodo: periodoLabel,
        fechaInicio: fechaInicioMes,
        fechaFin: fechaFinMes,
        pdfBlob,
      });
    } catch (error) {
      console.error("Error publicando:", error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleShare = async () => {
    if (!programaPublicadoExistente?.pdf_path) return;
    const url = await getProgramaPdfSignedUrl(programaPublicadoExistente.pdf_path);
    if (!url) { alert("No se pudo generar el enlace del PDF"); return; }
    const shareData = {
      title: `Programa Reunión Pública - ${MESES[mes]} ${anio}`,
      text: `Programa de Reunión Pública para ${MESES[mes]} ${anio}`,
      url,
    };
    if (navigator.share && navigator.canShare(shareData)) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert("Enlace copiado al portapapeles (válido por 1 hora)");
    }
  };


  const handleLimpiar = async () => {
    if (!congregacionActual?.id) return;
    setIsLimpiando(true);
    try {
      const { error } = await supabase
        .from("programa_reunion_publica")
        .delete()
        .eq("congregacion_id", congregacionActual.id)
        .gte("fecha", fechaInicioMes)
        .lte("fecha", fechaFinMes);
      if (error) throw error;
      setEditingData({});
      setOradorLocalOverride({});
      await queryClient.invalidateQueries({ queryKey: ["programa-reunion-publica"] });
      toast.success("Programa limpiado");
      setLimpiarOpen(false);
    } catch (e) {
      console.error("Error limpiando programa:", e);
      toast.error("Error al limpiar el programa");
    } finally {
      setIsLimpiando(false);
    }
  };


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
  const [oradorLocalOverride, setOradorLocalOverride] = useState<Record<string, boolean>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if orador is local for a given date
  const isOradorLocal = (fechaStr: string): boolean => {
    if (oradorLocalOverride[fechaStr] !== undefined) return oradorLocalOverride[fechaStr];
    // If orador_id is set in editing data, it's local
    if (editingData[fechaStr]?.orador_id) return true;
    // Check saved program data
    const programaFecha = programa?.find(p => p.fecha === fechaStr);
    return !!programaFecha?.orador_id;
  };

  const handleToggleOradorLocal = (fechaStr: string, isLocal: boolean) => {
    if (isReadOnly) return;
    setOradorLocalOverride(prev => ({ ...prev, [fechaStr]: isLocal }));
    if (isLocal) {
      // Switching to local: clear text fields
      setEditingData(prev => ({
        ...prev,
        [fechaStr]: {
          ...prev[fechaStr],
          orador_nombre: null,
          orador_congregacion: null,
        }
      }));
    } else {
      // Switching to visitante: clear orador_id
      setEditingData(prev => ({
        ...prev,
        [fechaStr]: {
          ...prev[fechaStr],
          orador_id: null,
        }
      }));
    }
  };

  // Auto-guardado silencioso: guarda todas las fechas pendientes de fondo, sin
  // mostrar ningún indicador visual — igual que en el editor de Vida y Ministerio.
  const guardarTodosLosPendientes = useCallback(async () => {
    const fechasPendientes = Object.keys(editingData).filter(f => Object.keys(editingData[f] || {}).length > 0);
    if (fechasPendientes.length === 0) return;

    try {
      for (const fecha of fechasPendientes) {
        await guardarPrograma.mutateAsync({
          fecha,
          ...editingData[fecha],
        });
      }
      setEditingData({});
    } catch {
      // el hook ya muestra toast de error
    }
  }, [editingData, guardarPrograma]);

  // Debounce de 2s en cada cambio, de fondo
  useEffect(() => {
    const hasPending = Object.keys(editingData).some(f => Object.keys(editingData[f] || {}).length > 0);
    if (!hasPending) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      guardarTodosLosPendientes();
    }, 2000);

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

  // Nombre a mostrar cuando el participante asignado ya no está entre las opciones
  // elegibles (inactivado o eliminado de la congregación): primero se intenta con
  // todosParticipantes (inactivado, dato real); si no existe (eliminado), se usa el
  // nombre guardado en nombres_snapshot al momento de la asignación.
  const nombreNoDisponible = (id: string | null | undefined, fecha: string): string | null => {
    if (!id) return null;
    const inactivo = (todosParticipantes ?? []).find((p) => p.id === id);
    if (inactivo) return `${inactivo.apellido}, ${inactivo.nombre}`;
    const programaFecha = programa?.find((p) => p.fecha === fecha);
    const snap = (programaFecha as any)?.nombres_snapshot?.[id];
    return snap || "(participante no disponible)";
  };

  // Mapas fecha -> fecha anterior/siguiente (para "no repetir Presidencia/Lector Atalaya
  // en reuniones seguidas"). Se leen combinando lo guardado + lo que está en edición en
  // memoria (getValorProgramado), así el bloqueo es instantáneo y no depende del autoguardado.
  const prevFechaMapRP = useMemo(() => {
    const m = new Map<string, string>();
    for (let i = 1; i < fechasReunion.length; i++) {
      m.set(format(fechasReunion[i], "yyyy-MM-dd"), format(fechasReunion[i - 1], "yyyy-MM-dd"));
    }
    return m;
  }, [fechasReunion]);

  const nextFechaMapRP = useMemo(() => {
    const m = new Map<string, string>();
    for (let i = 0; i < fechasReunion.length - 1; i++) {
      m.set(format(fechasReunion[i], "yyyy-MM-dd"), format(fechasReunion[i + 1], "yyyy-MM-dd"));
    }
    return m;
  }, [fechasReunion]);

  // Presidencia y Lector de la Atalaya forman un solo grupo de exclusión: quien haya
  // estado en cualquiera de los dos cargos en una fecha no puede estar en ninguno de
  // los dos en la reunión inmediatamente anterior ni en la siguiente.
  const presidenciaOLectorEnFecha = (fecha: string): Set<string> => {
    const s = new Set<string>();
    const presidente = getValorProgramado(fecha, "presidente_id");
    const lector = getValorProgramado(fecha, "lector_atalaya_id");
    if (presidente) s.add(presidente);
    if (lector) s.add(lector);
    return s;
  };

  const opcionesPresidenciaOLector = <T extends { id: string }>(
    fechaStr: string,
    opcionesBase: T[],
    slotActualId: string | null
  ): T[] => {
    const prevFecha = prevFechaMapRP.get(fechaStr);
    const nextFecha = nextFechaMapRP.get(fechaStr);
    const bloqueados = new Set<string>();
    if (prevFecha) presidenciaOLectorEnFecha(prevFecha).forEach((id) => bloqueados.add(id));
    if (nextFecha) presidenciaOLectorEnFecha(nextFecha).forEach((id) => bloqueados.add(id));
    return opcionesBase.filter((p) => p.id === slotActualId || !bloqueados.has(p.id));
  };

  const handleCambio = (fecha: string, campo: string, valor: string) => {
    if (isReadOnly) return;
    const newData: Record<string, any> = {
      [campo]: valor === "__none__" ? null : (valor || null),
    };

    // When selecting a local orador, also populate orador_nombre for display consistency
    if (campo === "orador_id" && valor && valor !== "__none__") {
      const p = participantesElegibles.find(p => p.id === valor);
      if (p) {
        newData.orador_nombre = `${p.nombre} ${p.apellido}`;
        newData.orador_congregacion = congregacionActual?.nombre || null;
      }
    }

    setEditingData(prev => ({
      ...prev,
      [fecha]: {
        ...prev[fecha],
        ...newData,
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
      {isReadOnly && (
        <Alert className="bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Tu rol no tiene permisos para modificar el programa de Reunión Pública. Solo puedes consultar la información.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programa Reunión Pública</h1>
        <div className="flex items-center gap-3">
          <TooltipProvider>
            {!isReadOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLimpiarOpen(true)}
                    disabled={isLimpiando || !programa || programa.length === 0}
                    className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-600"
                    aria-label="Limpiar programa"
                  >
                    <Eraser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpiar Programa</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPrintPreview(true)}
                  className="bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-600"
                  aria-label="Vista previa"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vista previa</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePrint()}
                  className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-600"
                  aria-label="Generar PDF"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>PDF</TooltipContent>
            </Tooltip>
            {!isReadOnly && puedeCrear && mostrarPublicar && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePublicar}
                    disabled={isPublishing || publicarPrograma.isPending}
                    className="bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-600"
                    aria-label={hayCambiosSinPublicar ? "Publicar cambios" : "Publicar programa"}
                  >
                    {isPublishing || publicarPrograma.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hayCambiosSinPublicar ? "Publicar cambios" : "Publicar"}
                </TooltipContent>
              </Tooltip>
            )}
            {!isReadOnly && puedeCrear && mostrarDespublicar && (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-600"
                        aria-label="Despublicar programa"
                        disabled={eliminarPrograma.isPending}
                      >
                        {eliminarPrograma.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Despublicar</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Despublicar programa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará el PDF publicado de Reunión Pública de{" "}
                      <span className="font-semibold capitalize">{mesAnio}</span> y dejará de estar
                      disponible para todos los usuarios. Podrás volver a publicarlo cuando quieras.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        if (programaPublicadoExistente) eliminarPrograma.mutate(programaPublicadoExistente);
                      }}
                    >
                      Despublicar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {puedeCerrarReunionPublica && (
              <CierreProgramaModal
                programaPublicado={programaPublicadoExistente}
                onCerrar={() => programaPublicadoExistente && cerrarPrograma.mutate(programaPublicadoExistente.id)}
                onReabrir={() => programaPublicadoExistente && reabrirPrograma.mutate(programaPublicadoExistente.id)}
                isPendingCerrar={cerrarPrograma.isPending}
                isPendingReabrir={reabrirPrograma.isPending}
                onPublicarPrimero={() => toast.error("Primero publica el programa para poder cerrarlo")}
                canReopen={puedeCerrarAbrir}
              />
            )}
          </TooltipProvider>
        </div>
      </div>

      {/* Selector de mes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => handleCambioMes(-1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Mes anterior
            </Button>
            <div className="text-center">
              <CardTitle className="text-lg">
                {MESES[mes]} {anio}
              </CardTitle>
              {!(mes === mesActualReal && anio === anioActualReal) && (
                <button
                  type="button"
                  onClick={() => {
                    setMes(mesActualReal);
                    setAnio(anioActualReal);
                  }}
                  className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
                >
                  Ir al mes actual
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <SelectorMesPopover
                mes={mes}
                anio={anio}
                onChange={(m, a) => {
                  setMes(m);
                  setAnio(a);
                }}
              />
              <Button variant="outline" size="sm" onClick={() => handleCambioMes(1)}>
                Mes siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
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
                          <ParticipanteSelectorRP
                            value={getValorProgramado(fechaStr, "presidente_id") || null}
                            onChange={(v) => handleCambio(fechaStr, "presidente_id", v ?? "__none__")}
                            opciones={opcionesPresidenciaOLector(fechaStr, participantesElegibles, getValorProgramado(fechaStr, "presidente_id") || null)}
                            ultimasMap={ultimasMapRP}
                            configuraciones={configsRP}
                            categoria="presidencia"
                            fechaPrograma={fechaStr}
                            disabled={isReadOnly}
                            nombreNoDisponible={nombreNoDisponible(getValorProgramado(fechaStr, "presidente_id") || null, fechaStr)}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Orador - Switch Local/Visitante */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Orador</td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      const esLocal = isOradorLocal(fechaStr);
                      return (
                        <td key={fechaStr} className="p-2">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`orador-local-${fechaStr}`}
                                checked={esLocal}
                                onCheckedChange={(checked) => handleToggleOradorLocal(fechaStr, checked)}
                                disabled={isReadOnly}
                              />
                              <Label htmlFor={`orador-local-${fechaStr}`} className="text-xs text-muted-foreground cursor-pointer">
                                {esLocal ? "Local" : "Visitante"}
                              </Label>
                            </div>
                            {esLocal ? (
                              <Select
                                value={getValorProgramado(fechaStr, "orador_id") || ""}
                                onValueChange={(v) => handleCambio(fechaStr, "orador_id", v)}
                                disabled={isReadOnly}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Sin asignar —</SelectItem>
                                  {(() => {
                                    const actualId = getValorProgramado(fechaStr, "orador_id") || null;
                                    const noDisponible = actualId && !participantesElegibles.some((p) => p.id === actualId)
                                      ? nombreNoDisponible(actualId, fechaStr)
                                      : null;
                                    return noDisponible && (
                                      <SelectItem value={actualId!}>
                                        <span className="italic text-muted-foreground">{noDisponible}</span>
                                      </SelectItem>
                                    );
                                  })()}
                                  {participantesElegibles.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.apellido}, {p.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={getValorProgramado(fechaStr, "orador_nombre") || ""}
                                onChange={(e) => handleCambio(fechaStr, "orador_nombre", e.target.value)}
                                placeholder="Nombre del orador..."
                                className="w-full"
                                disabled={isReadOnly}
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Congregación (solo aplica cuando el orador es visitante) */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Congregación</td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      const esLocal = isOradorLocal(fechaStr);
                      return (
                        <td key={fechaStr} className="p-2">
                          <Input
                            value={esLocal ? "" : (getValorProgramado(fechaStr, "orador_congregacion") || "")}
                            onChange={(e) => handleCambio(fechaStr, "orador_congregacion", e.target.value)}
                            placeholder={esLocal ? "—" : "Congregación..."}
                            className="w-full"
                            disabled={isReadOnly || esLocal}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Tema */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Tema</td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Input
                            value={getValorProgramado(fechaStr, "tema_discurso") || ""}
                            onChange={(e) => handleCambio(fechaStr, "tema_discurso", e.target.value)}
                            placeholder="Tema..."
                            className="w-full"
                            disabled={isReadOnly}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Lector de la Atalaya */}
                  <tr className="border-b">
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Lector de la Atalaya</td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <ParticipanteSelectorRP
                            value={getValorProgramado(fechaStr, "lector_atalaya_id") || null}
                            onChange={(v) => handleCambio(fechaStr, "lector_atalaya_id", v ?? "__none__")}
                            opciones={opcionesPresidenciaOLector(fechaStr, participantesLector, getValorProgramado(fechaStr, "lector_atalaya_id") || null)}
                            ultimasMap={ultimasMapRP}
                            configuraciones={configsRP}
                            categoria="lector_atalaya"
                            fechaPrograma={fechaStr}
                            disabled={isReadOnly}
                            emptyMessage="Configure lectores elegibles"
                            nombreNoDisponible={nombreNoDisponible(getValorProgramado(fechaStr, "lector_atalaya_id") || null, fechaStr)}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Conductor de la Atalaya */}
                  <tr>
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Conductor de la Atalaya</td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Select
                            value={getValorProgramado(fechaStr, "conductor_atalaya_id") || ""}
                            onValueChange={(v) => handleCambio(fechaStr, "conductor_atalaya_id", v)}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Sin asignar —</SelectItem>
                              {(() => {
                                const actualId = getValorProgramado(fechaStr, "conductor_atalaya_id") || null;
                                const noDisponible = actualId && !participantesConductor.some((p) => p.id === actualId)
                                  ? nombreNoDisponible(actualId, fechaStr)
                                  : null;
                                return noDisponible && (
                                  <SelectItem value={actualId!}>
                                    <span className="italic text-muted-foreground">{noDisponible}</span>
                                  </SelectItem>
                                );
                              })()}
                              {participantesConductor.length > 0 ? (
                                participantesConductor.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.apellido}, {p.nombre}
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
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Orador Saliente / Orador Suplente: recuadro aparte, no forman parte del programa semanal en sí */}
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
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Sin asignar —</SelectItem>
                              {(() => {
                                const actualId = getValorProgramado(fechaStr, "orador_saliente_id") || null;
                                const noDisponible = actualId && !participantesElegibles.some((p) => p.id === actualId)
                                  ? nombreNoDisponible(actualId, fechaStr)
                                  : null;
                                return noDisponible && (
                                  <SelectItem value={actualId!}>
                                    <span className="italic text-muted-foreground">{noDisponible}</span>
                                  </SelectItem>
                                );
                              })()}
                              {participantesElegibles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.apellido}, {p.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Orador Suplente */}
                  <tr>
                    <td className="p-3 font-medium text-sm sticky left-0 bg-background">Orador Suplente</td>
                    {fechasReunion.map((fecha) => {
                      const fechaStr = format(fecha, "yyyy-MM-dd");
                      return (
                        <td key={fechaStr} className="p-2">
                          <Select
                            value={getValorProgramado(fechaStr, "orador_suplente_id") || ""}
                            onValueChange={(v) => handleCambio(fechaStr, "orador_suplente_id", v)}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Sin asignar —</SelectItem>
                              {(() => {
                                const actualId = getValorProgramado(fechaStr, "orador_suplente_id") || null;
                                const noDisponible = actualId && !participantesElegibles.some((p) => p.id === actualId)
                                  ? nombreNoDisponible(actualId, fechaStr)
                                  : null;
                                return noDisponible && (
                                  <SelectItem value={actualId!}>
                                    <span className="italic text-muted-foreground">{noDisponible}</span>
                                  </SelectItem>
                                );
                              })()}
                              {participantesElegibles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.apellido}, {p.nombre}
                                </SelectItem>
                              ))}
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
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-auto p-3">
          <DialogHeader className="pb-2">
            <DialogTitle className="capitalize">
              Programa Reunión Pública - {MESES[mes]} {anio}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[80vh]">
            <div>
              <ImpresionReunionPublica
                programa={programa || []}
                participantes={participantes || []}
                fechas={fechasReunion}
                congregacionNombre={congregacionActual?.nombre || ""}
                mesAnio={mesAnio}
                colorTema={colorTema}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setShowPrintPreview(false)}
            >
              Cerrar
            </Button>
            {programaPublicadoExistente && (
              <Button variant="outline" onClick={handleShare} className="gap-2">
                <Share2 className="h-4 w-4" />
                Compartir
              </Button>
            )}
            <Button onClick={() => handlePrint()} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            {!isReadOnly && (
              <Button
                onClick={handlePublicar}
                disabled={isPublishing || publicarPrograma.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {isPublishing || publicarPrograma.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {programaPublicadoExistente ? "Actualizar Publicación" : "Publicar"}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Componente oculto para generar PDF al publicar */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "800px",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -9999,
          overflow: "hidden",
        }}
      >
        <ImpresionReunionPublica
          ref={publishRef}
          programa={programa || []}
          participantes={participantes || []}
          fechas={fechasReunion}
          congregacionNombre={congregacionActual?.nombre || ""}
          mesAnio={mesAnio}
          colorTema={colorTema}
        />
      </div>

      {/* Componente oculto para impresión (botón PDF del toolbar) — siempre montado,
          independiente de si la vista previa está abierta. */}
      <div style={{ position: "absolute", left: "-99999px", top: 0 }}>
        <ImpresionReunionPublica
          ref={printRef}
          programa={programa || []}
          participantes={participantes || []}
          fechas={fechasReunion}
          congregacionNombre={congregacionActual?.nombre || ""}
          mesAnio={mesAnio}
          colorTema={colorTema}
        />
      </div>

      <AlertDialog open={limpiarOpen} onOpenChange={setLimpiarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar todo el programa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todas las asignaciones del Programa de Reunión Pública para {MESES[mes]} {anio}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLimpiando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLimpiar();
              }}
              disabled={isLimpiando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLimpiando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Limpiando...
                </>
              ) : (
                <>
                  <Eraser className="h-4 w-4 mr-2" />
                  Sí, limpiar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
