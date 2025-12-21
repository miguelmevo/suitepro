import { useState, useRef } from "react";

import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Download, Image, FileText, Share2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ProgramaTable } from "@/components/programa/ProgramaTable";
import { PeriodoSelector } from "@/components/programa/PeriodoSelector";
import { ConfiguracionModal } from "@/components/programa/ConfiguracionModal";
import { ImpresionPrograma } from "@/components/programa/ImpresionPrograma";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { PeriodoPrograma } from "@/types/programa-predicacion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function ProgramaMensual() {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState<PeriodoPrograma>("mensual");
  const [fechaInicio, setFechaInicio] = useState<Date>(startOfMonth(hoy));
  const [fechaFin, setFechaFin] = useState<Date>(endOfMonth(hoy));
  const [isExporting, setIsExporting] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  const fechaInicioStr = format(fechaInicio, "yyyy-MM-dd");
  const fechaFinStr = format(fechaFin, "yyyy-MM-dd");
  const mesAnio = format(fechaInicio, "MMMM yyyy", { locale: es });

  const { 
    programa, 
    horarios,
    puntos,
    territorios,
    isLoading: loadingPrograma, 
    crearEntrada,
    actualizarEntrada,
    eliminarEntrada 
  } = useProgramaPredicacion(fechaInicioStr, fechaFinStr);

  const { 
    crearHorario,
    crearPuntoEncuentro,
    crearTerritorio,
    isLoading: loadingCatalogos 
  } = useCatalogos();

  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { diasEspeciales, crearDiaEspecial, eliminarDiaEspecial } = useDiasEspeciales();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  const { grupos: gruposPredicacion, isLoading: loadingGrupos } = useGruposPredicacion();

  // Obtener configuración de días de reunión
  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as { dia_entre_semana?: string; hora_entre_semana?: string; dia_fin_semana?: string; hora_fin_semana?: string } | undefined;

  const isLoading = loadingPrograma || loadingCatalogos || loadingParticipantes || loadingConfig || loadingGrupos;

  // Función para capturar el contenido como canvas
  const captureContent = async (): Promise<HTMLCanvasElement | null> => {
    if (!printRef.current) return null;
    
    // Mostrar temporalmente el contenido para captura
    const container = printRef.current.parentElement;
    if (container) {
      container.style.display = "block";
      container.style.position = "absolute";
      container.style.left = "-9999px";
    }

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      return canvas;
    } finally {
      if (container) {
        container.style.display = "none";
        container.style.position = "";
        container.style.left = "";
      }
    }
  };

  // Descargar como PDF
  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const canvas = await captureContent();
      if (!canvas) {
        toast.error("Error al generar el PDF");
        return;
      }

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calcular dimensiones para PDF (A4 landscape o portrait según aspecto)
      const pdfWidth = imgWidth > imgHeight ? 297 : 210;
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
      
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? "landscape" : "portrait",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Programa_Predicacion_${mesAnio.replace(" ", "_")}.pdf`);
      
      toast.success("PDF descargado correctamente");
    } catch (error) {
      console.error("Error al generar PDF:", error);
      toast.error("Error al generar el PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Descargar como imagen
  const handleDownloadImage = async () => {
    setIsExporting(true);
    try {
      const canvas = await captureContent();
      if (!canvas) {
        toast.error("Error al generar la imagen");
        return;
      }

      const link = document.createElement("a");
      link.download = `Programa_Predicacion_${mesAnio.replace(" ", "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      toast.success("Imagen descargada correctamente");
    } catch (error) {
      console.error("Error al generar imagen:", error);
      toast.error("Error al generar la imagen");
    } finally {
      setIsExporting(false);
    }
  };

  // Compartir por WhatsApp
  const handleShareWhatsApp = async () => {
    setIsExporting(true);
    try {
      const canvas = await captureContent();
      if (!canvas) {
        toast.error("Error al generar la imagen");
        return;
      }

      // Convertir canvas a blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });

      if (blob && navigator.share && navigator.canShare) {
        const file = new File([blob], `Programa_Predicacion_${mesAnio.replace(" ", "_")}.png`, {
          type: "image/png",
        });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Programa de Predicación - ${mesAnio}`,
            text: `Programa de Predicación - ${mesAnio}`,
            files: [file],
          });
          toast.success("Compartido correctamente");
        } else {
          // Fallback: abrir WhatsApp con texto
          const url = `https://wa.me/?text=${encodeURIComponent(`Programa de Predicación - ${mesAnio}`)}`;
          window.open(url, "_blank");
        }
      } else {
        // Fallback para navegadores sin Web Share API
        const url = `https://wa.me/?text=${encodeURIComponent(`Programa de Predicación - ${mesAnio}`)}`;
        window.open(url, "_blank");
        toast.info("Descarga la imagen primero para compartirla en WhatsApp");
      }
    } catch (error) {
      console.error("Error al compartir:", error);
      // Si el usuario cancela, no mostrar error
      if ((error as Error).name !== "AbortError") {
        toast.error("Error al compartir");
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Generar las fechas del período seleccionado
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Programa Mensual</h1>
          <p className="text-muted-foreground">
            Gestiona el programa de predicación
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isLoading || isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Descargar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Descargar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadImage}>
                <Image className="h-4 w-4 mr-2" />
                Descargar Imagen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleShareWhatsApp}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartir en WhatsApp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfiguracionModal 
            horarios={horarios}
            puntos={puntos}
            territorios={territorios}
            diasEspeciales={diasEspeciales}
            onCrearHorario={(data) => crearHorario.mutate(data)}
            onCrearPunto={(data) => crearPuntoEncuentro.mutate(data)}
            onCrearTerritorio={(data) => crearTerritorio.mutate(data)}
            onCrearDiaEspecial={(data) => crearDiaEspecial.mutate(data)}
            onEliminarDiaEspecial={(id) => eliminarDiaEspecial.mutate(id)}
            isLoading={crearHorario.isPending || crearPuntoEncuentro.isPending || crearTerritorio.isPending}
          />
        </div>
      </div>

      {/* Componente oculto para captura/impresión */}
      <div style={{ display: "none" }}>
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
          diasReunionConfig={diasReunionConfig}
          mesAnio={mesAnio}
        />
      </div>

      <PeriodoSelector 
        periodo={periodo}
        onPeriodoChange={setPeriodo}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        onFechasChange={handleFechasChange}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <ProgramaTable
          programa={programa}
          horarios={horarios}
          fechas={fechas}
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
          gruposPredicacion={gruposPredicacion || []}
          diasEspeciales={diasEspeciales}
          onCrearEntrada={(data) => crearEntrada.mutate(data)}
          onActualizarEntrada={(id, data) => actualizarEntrada.mutate({ id, ...data })}
          onEliminarEntrada={(id) => eliminarEntrada.mutate(id)}
          isCreating={crearEntrada.isPending}
          diasReunionConfig={diasReunionConfig}
        />
      )}
    </div>
  );
}