import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { History, FileText, Calendar, Download, Eye, Loader2 } from "lucide-react";
import { useProgramasPublicados, ProgramaPublicado } from "@/hooks/useProgramasPublicados";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Historial() {
  const { programas, isLoading } = useProgramasPublicados();
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPrograma, setSelectedPrograma] = useState<ProgramaPublicado | null>(null);

  // Mostrar solo los últimos 6 programas
  const ultimosProgramas = programas.slice(0, 6);

  const handleVerPdf = (programa: ProgramaPublicado) => {
    setSelectedPrograma(programa);
    setPdfModalOpen(true);
  };

  const handleDescargar = (programa: ProgramaPublicado) => {
    window.open(programa.pdf_url, "_blank");
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
          {ultimosProgramas.map((programa) => (
            <Card key={programa.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-lg mt-2">{programa.periodo}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    Publicado: {format(parseISO(programa.created_at), "d MMM yyyy", { locale: es })}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  <p>
                    Período: {formatFecha(programa.fecha_inicio)} - {formatFecha(programa.fecha_fin)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleVerPdf(programa)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDescargar(programa)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para ver PDF */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-4xl h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedPrograma?.periodo}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-0">
            {selectedPrograma && (
              <iframe 
                src={selectedPrograma.pdf_url}
                className="w-full h-[calc(85vh-100px)] border rounded-lg"
                title={`PDF ${selectedPrograma.periodo}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
