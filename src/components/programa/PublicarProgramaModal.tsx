import { useState, useRef } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Upload, Loader2, FileText, Trash2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PeriodoSelector } from "@/components/programa/PeriodoSelector";
import { ImpresionPrograma } from "@/components/programa/ImpresionPrograma";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useMensajesAdicionales } from "@/hooks/useMensajesAdicionales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useProgramasPublicados, ProgramaPublicado } from "@/hooks/useProgramasPublicados";
import { PeriodoPrograma } from "@/types/programa-predicacion";
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

interface PublicarProgramaModalProps {
  tipoProgramaId: string;
  tipoProgramaNombre: string;
  programaPublicado?: ProgramaPublicado | null;
}

export function PublicarProgramaModal({
  tipoProgramaId,
  tipoProgramaNombre,
  programaPublicado,
}: PublicarProgramaModalProps) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const hoy = new Date();
  const [periodo, setPeriodo] = useState<PeriodoPrograma>("mensual");
  const [fechaInicio, setFechaInicio] = useState<Date>(startOfMonth(hoy));
  const [fechaFin, setFechaFin] = useState<Date>(endOfMonth(hoy));

  const fechaInicioStr = format(fechaInicio, "yyyy-MM-dd");
  const fechaFinStr = format(fechaFin, "yyyy-MM-dd");
  const mesAnio = format(fechaInicio, "MMMM yyyy", { locale: es });

  const { programa, horarios, puntos, territorios, isLoading: loadingPrograma } = 
    useProgramaPredicacion(fechaInicioStr, fechaFinStr);
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { diasEspeciales } = useDiasEspeciales();
  const { mensajesAdicionales } = useMensajesAdicionales();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  const { grupos: gruposPredicacion, isLoading: loadingGrupos } = useGruposPredicacion();
  const { publicarPrograma, eliminarPrograma } = useProgramasPublicados();

  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as { dia_entre_semana?: string; hora_entre_semana?: string; dia_fin_semana?: string; hora_fin_semana?: string } | undefined;

  const isLoading = loadingPrograma || loadingParticipantes || loadingConfig || loadingGrupos;

  const generarFechas = (): string[] => {
    const fechas: string[] = [];
    const current = new Date(fechaInicio);
    const end = new Date(fechaFin);
    while (current <= end) {
      fechas.push(format(current, "yyyy-MM-dd"));
      current.setDate(current.getDate() + 1);
    }
    return fechas;
  };

  const fechas = generarFechas();

  const handleFechasChange = (inicio: Date, fin: Date) => {
    setFechaInicio(inicio);
    setFechaFin(fin);
  };

  const handlePublicar = async () => {
    if (!printRef.current) return;

    setIsGenerating(true);
    try {
      // Generar canvas del componente de impresión
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // Crear PDF tamaño carta
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      });

      const imgWidth = 216; // Letter width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        0,
        imgWidth,
        Math.min(imgHeight, 279) // Letter height in mm
      );

      // Convertir a Blob
      const pdfBlob = pdf.output("blob");

      // Publicar
      await publicarPrograma.mutateAsync({
        tipoProgramaId,
        periodo: mesAnio,
        fechaInicio: fechaInicioStr,
        fechaFin: fechaFinStr,
        pdfBlob,
      });

      setOpen(false);
    } catch (error) {
      console.error("Error generando PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEliminar = async () => {
    if (programaPublicado) {
      await eliminarPrograma.mutateAsync(programaPublicado);
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="gap-2">
            <Upload className="h-4 w-4" />
            {programaPublicado ? "Actualizar" : "Publicar"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Publicar {tipoProgramaNombre}</DialogTitle>
            <DialogDescription>
              Selecciona el período y genera el PDF para publicar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <PeriodoSelector
              periodo={periodo}
              onPeriodoChange={setPeriodo}
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              onFechasChange={handleFechasChange}
            />

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : programa.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay entradas en el programa para este período</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Período:</strong> {mesAnio}
                  </p>
                  <p className="text-sm">
                    <strong>Entradas:</strong> {programa.length}
                  </p>
                </div>

                <Button
                  onClick={handlePublicar}
                  disabled={isGenerating || publicarPrograma.isPending}
                  className="w-full"
                >
                  {isGenerating || publicarPrograma.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Generar y Publicar PDF
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Componente oculto para generar PDF */}
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <ImpresionPrograma
              ref={printRef}
              programa={programa}
              horarios={horarios}
              fechas={fechas}
              puntos={puntos}
              territorios={territorios}
              participantes={participantes}
              gruposPredicacion={gruposPredicacion || []}
              diasEspeciales={diasEspeciales}
              mensajesAdicionales={mensajesAdicionales}
              diasReunionConfig={diasReunionConfig}
              mesAnio={mesAnio}
            />
          </div>
        </DialogContent>
      </Dialog>

      {programaPublicado && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar programa publicado?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el PDF publicado. Los usuarios ya no podrán descargarlo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleEliminar}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
