import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Calendar, Eye, Loader2, Printer, Share2, Megaphone } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImpresionProgramaWrapper } from "@/components/programa/ImpresionProgramaWrapper";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useFormatoImpresion } from "@/hooks/useFormatoImpresion";
import type { ProgramaPublicado } from "@/hooks/useProgramasPublicados";

interface BloqueProps {
  programa: ProgramaPublicado;
  etiquetaBoton: string;
  participantes: any[];
  gruposPredicacion: any[];
  diasEspeciales: any[];
  mensajesAdicionales: any[];
  diasReunionConfig: any;
  carritos: any[];
  onShare: (programa: { pdf_url: string; periodo: string }, tipo: string) => void;
}

function BloquePrograma({
  programa,
  etiquetaBoton,
  participantes,
  gruposPredicacion,
  diasEspeciales,
  mensajesAdicionales,
  diasReunionConfig,
  carritos,
  onShare,
}: BloqueProps) {
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const formatoImpresion = useFormatoImpresion();

  const {
    programa: programaPred,
    horarios,
    puntos,
    territorios,
    direccionesBloqueadas,
    isLoading: loadingProgramaPred,
  } = useProgramaPredicacion(programa.fecha_inicio, programa.fecha_fin);

  const fechasPred = (() => {
    try {
      const inicio = parseISO(programa.fecha_inicio);
      const fin = parseISO(programa.fecha_fin);
      return eachDayOfInterval({ start: inicio, end: fin }).map((d) => format(d, "yyyy-MM-dd"));
    } catch {
      return [];
    }
  })();
  const mesAnio = format(parseISO(programa.fecha_inicio), "MMMM yyyy", { locale: es });

  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: "Programa de Predicación" });

  return (
    <div className="bg-muted/50 p-3 rounded-lg space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium capitalize">{programa.periodo}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Actualizado:{" "}
        {format(new Date(programa.updated_at || programa.created_at), "d 'de' MMMM, yyyy 'a las' h:mm a", { locale: es })}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="w-full gap-2">
            <Eye className="h-4 w-4" />
            {etiquetaBoton}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-auto p-3">
          <DialogHeader className="pb-2">
            <DialogTitle className="capitalize">Programa de Predicación - {programa.periodo}</DialogTitle>
          </DialogHeader>
          <div className="w-full">
            {loadingProgramaPred ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-auto max-h-[80vh]">
                <div ref={printRef}>
                  <ImpresionProgramaWrapper
                    formato={formatoImpresion}
                    programa={programaPred}
                    horarios={horarios}
                    fechas={fechasPred}
                    puntos={puntos}
                    territorios={territorios}
                    participantes={participantes}
                    gruposPredicacion={gruposPredicacion || []}
                    diasEspeciales={diasEspeciales}
                    mensajesAdicionales={mensajesAdicionales}
                    diasReunionConfig={diasReunionConfig}
                    direccionesBloqueadas={direccionesBloqueadas}
                    mesAnio={mesAnio}
                    carritos={carritos}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </Button>
            <Button variant="outline" onClick={() => onShare(programa, "Programa de Predicación")} className="gap-2">
              <Share2 className="h-4 w-4" />
              Compartir
            </Button>
            <Button onClick={() => handlePrint()} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Props {
  programa: ProgramaPublicado | undefined;
  programaSiguiente?: ProgramaPublicado;
  loadingPublicado?: boolean;
  participantes: any[];
  gruposPredicacion: any[];
  diasEspeciales: any[];
  mensajesAdicionales: any[];
  diasReunionConfig: any;
  carritos: any[];
  onShare: (programa: { pdf_url: string; periodo: string }, tipo: string) => void;
}

export function CardProgramaPredicacion({
  programa,
  programaSiguiente,
  loadingPublicado,
  participantes,
  gruposPredicacion,
  diasEspeciales,
  mensajesAdicionales,
  diasReunionConfig,
  carritos,
  onShare,
}: Props) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg mb-2 bg-primary text-primary-foreground">
          <Megaphone className="h-6 w-6" />
        </div>
        <CardTitle>Programa de Predicación</CardTitle>
        <CardDescription>Programa mensual de predicación con horarios, territorios y capitanes</CardDescription>

        <div className="mt-4 space-y-3">
          {programa ? (
            <BloquePrograma
              programa={programa}
              etiquetaBoton="Ver Programa"
              participantes={participantes}
              gruposPredicacion={gruposPredicacion}
              diasEspeciales={diasEspeciales}
              mensajesAdicionales={mensajesAdicionales}
              diasReunionConfig={diasReunionConfig}
              carritos={carritos}
              onShare={onShare}
            />
          ) : (
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {loadingPublicado ? "Cargando..." : "No hay programa publicado"}
              </p>
            </div>
          )}

          {programaSiguiente && (
            <BloquePrograma
              programa={programaSiguiente}
              etiquetaBoton={`Ver Programa ${format(parseISO(programaSiguiente.fecha_inicio), "MMMM yyyy", { locale: es })}`}
              participantes={participantes}
              gruposPredicacion={gruposPredicacion}
              diasEspeciales={diasEspeciales}
              mensajesAdicionales={mensajesAdicionales}
              diasReunionConfig={diasReunionConfig}
              carritos={carritos}
              onShare={onShare}
            />
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
