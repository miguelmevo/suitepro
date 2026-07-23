import { useRef, useState, useMemo } from "react";
import { useReactToPrint } from "react-to-print";
import { format, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval, getDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Calendar, Eye, Printer, Share2, BookOpen } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImpresionReunionPublica } from "@/components/reunion-publica/ImpresionReunionPublica";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import type { ProgramaPublicado } from "@/hooks/useProgramasPublicados";

const DIA_SEMANA_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

interface BloqueProps {
  programa: ProgramaPublicado;
  etiquetaBoton: string;
  translucido?: boolean;
  participantes: any[];
  congregacionNombre: string;
  colorTema: string;
  diaFinSemanaStr: string;
  onShare: (programa: { pdf_url: string; periodo: string }, tipo: string) => void;
}

function BloquePrograma({ programa, etiquetaBoton, translucido, participantes, congregacionNombre, colorTema, diaFinSemanaStr, onShare }: BloqueProps) {
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fechaBase = parseISO(programa.fecha_inicio);
  const mes = fechaBase.getMonth();
  const anio = fechaBase.getFullYear();

  const { programa: programaReunionData } = useReunionPublica(mes, anio);
  const diaReunionNum = DIA_SEMANA_MAP[diaFinSemanaStr] ?? 0;

  const fechas = useMemo(() => {
    const inicio = startOfMonth(new Date(anio, mes));
    const fin = endOfMonth(new Date(anio, mes));
    const semanas = eachWeekOfInterval({ start: inicio, end: fin }, { weekStartsOn: 1 });
    return semanas
      .map((semana) => {
        const diff = (diaReunionNum - getDay(semana) + 7) % 7;
        return addDays(semana, diff);
      })
      .filter((fecha) => fecha >= inicio && fecha <= fin);
  }, [mes, anio, diaReunionNum]);

  const mesAnio = format(fechaBase, "MMMM yyyy", { locale: es });
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: "Programa Reunión Pública" });

  return (
    <div className="bg-muted/50 p-3 rounded-lg space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium capitalize">{programa.periodo}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Actualizado: {format(new Date(programa.updated_at || programa.created_at), "dd/MM/yyyy, HH:mm")}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant={translucido ? "ghost" : "default"}
            className={translucido ? "w-full gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20" : "w-full gap-2"}
          >
            <Eye className="h-4 w-4" />
            {etiquetaBoton}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-auto p-3">
          <DialogHeader className="pb-2">
            <DialogTitle className="capitalize">Programa Reunión Pública - {programa.periodo}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[80vh]">
            <div ref={printRef}>
              <ImpresionReunionPublica
                programa={programaReunionData || []}
                participantes={participantes || []}
                fechas={fechas}
                congregacionNombre={congregacionNombre}
                mesAnio={mesAnio}
                colorTema={colorTema}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </Button>
            <Button variant="outline" onClick={() => onShare(programa, "Programa Reunión Pública")} className="gap-2">
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
  congregacionNombre: string;
  colorTema: string;
  diaFinSemanaStr: string;
  onShare: (programa: { pdf_url: string; periodo: string }, tipo: string) => void;
}

export function CardProgramaReunionPublica({
  programa,
  programaSiguiente,
  loadingPublicado,
  participantes,
  congregacionNombre,
  colorTema,
  diaFinSemanaStr,
  onShare,
}: Props) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg leading-snug">Programa Reunión Pública</CardTitle>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {programa ? (
            <BloquePrograma
              programa={programa}
              etiquetaBoton="Ver Programa"
              participantes={participantes}
              congregacionNombre={congregacionNombre}
              colorTema={colorTema}
              diaFinSemanaStr={diaFinSemanaStr}
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
              translucido
              participantes={participantes}
              congregacionNombre={congregacionNombre}
              colorTema={colorTema}
              diaFinSemanaStr={diaFinSemanaStr}
              onShare={onShare}
            />
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
