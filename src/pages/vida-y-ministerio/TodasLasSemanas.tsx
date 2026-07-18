import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Eye,
  Sparkles,
  Download,
  Wand2,
  Eraser,
  CheckCircle2,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "sonner";
import EditorVidaMinisterio, { type EditorVidaMinisterioHandle } from "./Editor";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { ImpresionVidaMinisterio } from "@/components/vida-ministerio/ImpresionVidaMinisterio";

export default function TodasLasSemanasVidaMinisterio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mesParam = searchParams.get("mes");
  const desdeSemana = searchParams.get("desde");
  const [mesActual, setMesActual] = useState<Date>(() =>
    mesParam ? startOfMonth(parseISO(mesParam)) : startOfMonth(new Date())
  );

  const irAMes = (nuevoMes: Date) => {
    setMesActual(nuevoMes);
    setSearchParams({ mes: format(nuevoMes, "yyyy-MM-dd") });
  };

  const lunesDelMes = useMemo(() => {
    const dias = eachDayOfInterval({
      start: startOfMonth(mesActual),
      end: endOfMonth(mesActual),
    });
    return dias.filter((d) => d.getDay() === 1);
  }, [mesActual]);

  const fechasDelMes = useMemo(() => lunesDelMes.map((d) => format(d, "yyyy-MM-dd")), [lunesDelMes]);
  const nombreMes = format(mesActual, "MMMM yyyy", { locale: es });

  // Refs a cada editor embebido, para poder invocar acciones masivas desde afuera.
  const editorRefs = useRef<Map<string, EditorVidaMinisterioHandle>>(new Map());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmLimpiarTodasOpen, setConfirmLimpiarTodasOpen] = useState(false);
  const [cargandoMasivo, setCargandoMasivo] = useState(false);

  // Cola de "Asignar con IA" masivo: se abre una semana a la vez y se avanza
  // cuando esa semana cierra su modal (aplicado o cancelado).
  const [iaQueue, setIaQueue] = useState<string[]>([]);
  const [iaFechaActiva, setIaFechaActiva] = useState<string | null>(null);

  const iniciarIaMasiva = () => {
    const cola = [...fechasDelMes];
    const primera = cola.shift();
    if (!primera) return;
    setIaQueue(cola);
    setIaFechaActiva(primera);
    editorRefs.current.get(primera)?.abrirAsignacionIA();
  };

  const avanzarIaQueue = () => {
    setIaFechaActiva((actual) => {
      if (actual === null) return null;
      setIaQueue((cola) => {
        const [siguiente, ...resto] = cola;
        if (siguiente) {
          setTimeout(() => {
            setIaFechaActiva(siguiente);
            editorRefs.current.get(siguiente)?.abrirAsignacionIA();
          }, 200);
        } else {
          setIaFechaActiva(null);
          toast.success("Asignación con IA completada para todas las semanas");
        }
        return resto;
      });
      return actual;
    });
  };

  const cargarPlantillasMasivo = () => {
    let aplicadas = 0;
    editorRefs.current.forEach((handle) => {
      if (handle.tienePlantillaOficial) {
        handle.cargarPlantilla();
        aplicadas++;
      }
    });
    toast.success(
      aplicadas > 0
        ? `Plantilla cargada en ${aplicadas} semana${aplicadas === 1 ? "" : "s"}`
        : "No hay plantillas oficiales nuevas para cargar este mes"
    );
  };

  const limpiarTodasConfirmado = () => {
    setConfirmLimpiarTodasOpen(false);
    editorRefs.current.forEach((handle) => handle.limpiar());
    toast.success("Se vaciaron todas las semanas del mes");
  };

  const marcarCompletoMasivo = () => {
    let marcadas = 0;
    editorRefs.current.forEach((handle) => {
      if (!handle.isComplete) {
        handle.marcarCompleto();
        marcadas++;
      }
    });
    toast.success(
      marcadas > 0
        ? `${marcadas} semana${marcadas === 1 ? "" : "s"} marcada${marcadas === 1 ? "" : "s"} como completa${marcadas === 1 ? "" : "s"}`
        : "Todas las semanas ya estaban completas"
    );
  };

  // Datos para la vista previa combinada (reutiliza el mismo componente de impresión).
  const { data: programas } = useProgramasVidaMinisterio();
  const { participantes } = useParticipantes();
  const { congregacionActual } = useCongregacion();
  const { configuraciones } = useConfiguracionSistema("general");
  const { configuraciones: configsVyM } = useConfiguracionSistema("vida_ministerio");
  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as { hora_entre_semana?: string } | undefined;
  const horaInicio = diasReunionConfig?.hora_entre_semana || "19:30";
  const consejoMaestrosMins =
    (configsVyM?.find((c) => c.clave === "consejo_presidente_maestros")?.valor as { minutos?: number } | undefined)?.minutos ?? 0;
  const programasDelMes = useMemo(() => {
    const set = new Set(fechasDelMes);
    return (programas ?? []).filter((p) => set.has(p.fecha_semana));
  }, [programas, fechasDelMes]);

  const irASemanaIndividual = () => {
    const destino = desdeSemana ?? fechasDelMes[0];
    if (destino) navigate(`/vida-y-ministerio/${destino}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/vida-y-ministerio")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Todas las semanas</h1>
              <p className="text-sm text-muted-foreground capitalize">{nombreMes}</p>
            </div>
          </div>
        </div>

        <TooltipProvider>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPreviewOpen(true)}
                  disabled={programasDelMes.length === 0}
                  className="bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-600"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vista previa (todas)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={cargarPlantillasMasivo}
                  className="bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-600 relative"
                >
                  <Sparkles className="h-4 w-4" />
                  <Download className="h-2.5 w-2.5 absolute bottom-1 right-1" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cargar plantilla (todas)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={iniciarIaMasiva}
                  disabled={iaFechaActiva !== null || fechasDelMes.length === 0}
                  className="bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/20 text-violet-600"
                >
                  {iaFechaActiva ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Asignar con IA (todas, una por una)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setConfirmLimpiarTodasOpen(true)}
                  className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-600"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpiar todas las semanas</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={marcarCompletoMasivo}
                  disabled={cargandoMasivo}
                  className="bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-600"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marcar completas las que ya cumplen</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="default"
                  onClick={irASemanaIndividual}
                  className="gap-1.5 bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary"
                >
                  <CalendarDays className="h-4 w-4" />
                  Semana individual
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {desdeSemana ? "Volver a la semana de donde saliste" : "Ir a la primera semana del mes"}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <Button variant="outline" size="sm" onClick={() => irAMes(subMonths(mesActual, 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Mes anterior
          </Button>
          <div className="text-center">
            <div className="text-lg font-semibold capitalize">{nombreMes}</div>
            <button
              type="button"
              onClick={() => irAMes(startOfMonth(new Date()))}
              className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
            >
              Ir al mes actual
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => irAMes(addMonths(mesActual, 1))}>
            Mes siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {lunesDelMes.map((lunes) => {
          const fecha = format(lunes, "yyyy-MM-dd");
          return (
            <div key={fecha} className="shrink-0 w-[340px] border rounded-lg p-3">
              <EditorVidaMinisterio
                fecha={fecha}
                embedded
                ref={(handle) => {
                  if (handle) editorRefs.current.set(fecha, handle);
                  else editorRefs.current.delete(fecha);
                }}
                onIaFlowClosed={fecha === iaFechaActiva ? avanzarIaQueue : undefined}
              />
            </div>
          );
        })}
        {lunesDelMes.length === 0 && (
          <p className="text-sm text-muted-foreground py-6">No hay semanas en este mes.</p>
        )}
      </div>

      <ConfirmDeleteDialog
        open={confirmLimpiarTodasOpen}
        onOpenChange={setConfirmLimpiarTodasOpen}
        title="¿Vaciar todas las semanas del mes?"
        description={`Se borrarán los campos de las ${fechasDelMes.length} semanas de ${nombreMes}. Esta acción no se puede deshacer.`}
        onConfirm={limpiarTodasConfirmado}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="uppercase">Vista previa - Vida y Ministerio - {nombreMes}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {programasDelMes.length > 0 ? (
              <ImpresionVidaMinisterio
                programas={programasDelMes}
                participantes={participantes as any}
                congregacionNombre={congregacionActual?.nombre || ""}
                mesAnio={nombreMes}
                horaInicio={horaInicio}
                consejoMaestrosMins={consejoMaestrosMins}
              />
            ) : (
              <p className="text-sm text-muted-foreground p-6 text-center">
                No hay programas en este mes para previsualizar.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
