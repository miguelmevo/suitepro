import { useState, useRef } from "react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { History, FileText, Calendar, Download, Eye, Loader2, Printer, Share2 } from "lucide-react";
import { useProgramasPublicados, ProgramaPublicado } from "@/hooks/useProgramasPublicados";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useMensajesAdicionales } from "@/hooks/useMensajesAdicionales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { ImpresionPrograma } from "@/components/programa/ImpresionPrograma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReactToPrint } from "react-to-print";

export default function Historial() {
  const { programas, isLoading } = useProgramasPublicados();
  const [selectedPrograma, setSelectedPrograma] = useState<ProgramaPublicado | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Mostrar solo los últimos 6 programas
  const ultimosProgramas = programas.slice(0, 6);

  // Cargar datos del programa seleccionado
  const fechaInicioStr = selectedPrograma?.fecha_inicio || "";
  const fechaFinStr = selectedPrograma?.fecha_fin || "";

  const { 
    programa, 
    horarios,
    puntos,
    territorios,
    isLoading: loadingPrograma 
  } = useProgramaPredicacion(fechaInicioStr, fechaFinStr);

  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { diasEspeciales } = useDiasEspeciales();
  const { mensajesAdicionales } = useMensajesAdicionales();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  const { grupos: gruposPredicacion, isLoading: loadingGrupos } = useGruposPredicacion();

  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as { dia_entre_semana?: string; hora_entre_semana?: string; dia_fin_semana?: string; hora_fin_semana?: string } | undefined;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedPrograma ? `Programa - ${selectedPrograma.periodo}` : "Programa",
  });

  const handleShare = async () => {
    if (!selectedPrograma?.pdf_url) return;
    
    const shareData = {
      title: `Programa de Predicación - ${selectedPrograma.periodo}`,
      text: `Programa de Predicación para ${selectedPrograma.periodo}`,
      url: selectedPrograma.pdf_url,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log("Error sharing:", error);
      }
    } else {
      await navigator.clipboard.writeText(selectedPrograma.pdf_url);
      alert("Enlace copiado al portapapeles");
    }
  };

  const generarFechas = (): string[] => {
    if (!selectedPrograma) return [];
    try {
      const inicio = parseISO(selectedPrograma.fecha_inicio);
      const fin = parseISO(selectedPrograma.fecha_fin);
      return eachDayOfInterval({ start: inicio, end: fin }).map(d => format(d, "yyyy-MM-dd"));
    } catch {
      return [];
    }
  };

  const fechas = generarFechas();
  const mesAnio = selectedPrograma 
    ? format(parseISO(selectedPrograma.fecha_inicio), "MMMM yyyy", { locale: es })
    : "";

  const isLoadingData = loadingPrograma || loadingParticipantes || loadingConfig || loadingGrupos;

  const handleVerPrograma = (prog: ProgramaPublicado) => {
    setSelectedPrograma(prog);
    setPdfModalOpen(true);
  };

  const handleDescargar = (prog: ProgramaPublicado) => {
    window.open(prog.pdf_url, "_blank");
  };

  const formatFecha = (fecha: string) => {
    return format(parseISO(fecha), "d 'de' MMMM, yyyy", { locale: es });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Historial de Programas</h1>
          <p className="text-muted-foreground">Consulta programas anteriores</p>
        </div>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Historial de Programas</h1>
        <p className="text-muted-foreground">
          Consulta los últimos programas publicados
        </p>
      </div>

      {ultimosProgramas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <History className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Sin programas publicados</h3>
          <p className="text-muted-foreground max-w-md">
            Aún no hay programas publicados. Los programas aparecerán aquí 
            una vez que se publiquen desde la página de Programa Mensual.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ultimosProgramas.map((prog) => (
            <Card key={prog.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-lg mt-2 capitalize">{prog.periodo}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    Publicado: {format(parseISO(prog.created_at), "d MMM yyyy", { locale: es })}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  <p>
                    Período: {formatFecha(prog.fecha_inicio)} - {formatFecha(prog.fecha_fin)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleVerPrograma(prog)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver Programa
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDescargar(prog)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para ver programa renderizado */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Programa de Predicación - {selectedPrograma?.periodo}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full">
            {isLoadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-auto max-h-[75vh]">
                <div ref={printRef} className="transform scale-100 origin-top-left">
                  <ImpresionPrograma
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
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setPdfModalOpen(false)}
            >
              Cerrar
            </Button>
            <Button 
              variant="outline"
              onClick={handleShare}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              Compartir
            </Button>
            <Button 
              onClick={() => handlePrint()}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
