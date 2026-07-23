import { useRef, useState, useMemo } from "react";
import { useReactToPrint } from "react-to-print";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Calendar, Eye, Printer, Share2, GraduationCap } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImpresionVidaMinisterio } from "@/components/vida-ministerio/ImpresionVidaMinisterio";
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

function getMondayDate(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

interface Props {
  programa: ProgramaPublicado | undefined;
  loadingPublicado?: boolean;
  etiqueta?: string;
  programasVyM: any[];
  participantes: any[];
  congregacionNombre: string;
  diaEntreSemana: string;
  horaInicio: string;
  consejoMaestrosMins: number;
  onShare: (programa: { pdf_url: string; periodo: string }, tipo: string) => void;
}

export function CardProgramaVidaMinisterio({
  programa,
  loadingPublicado,
  etiqueta,
  programasVyM,
  participantes,
  congregacionNombre,
  diaEntreSemana,
  horaInicio,
  consejoMaestrosMins,
  onShare,
}: Props) {
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fechaBase = programa?.fecha_inicio ? parseISO(programa.fecha_inicio) : new Date();
  const diaEntreSemanaNum = DIA_SEMANA_MAP[diaEntreSemana ?? "martes"] ?? 2;
  const martesDelMes = useMemo(() => {
    const dias = eachDayOfInterval({ start: startOfMonth(fechaBase), end: endOfMonth(fechaBase) });
    return dias.filter((d) => d.getDay() === diaEntreSemanaNum);
  }, [fechaBase, diaEntreSemanaNum]);
  const programasVyMDelMes = useMemo(() => {
    const map = new Map<string, any>();
    (programasVyM ?? []).forEach((p: any) => map.set(p.fecha_semana, p));
    return martesDelMes.map((martes) => map.get(format(getMondayDate(martes), "yyyy-MM-dd"))).filter((p): p is any => !!p);
  }, [martesDelMes, programasVyM]);

  const mesAnio = programa ? format(parseISO(programa.fecha_inicio), "MMMM yyyy", { locale: es }) : "";
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Vida_y_Ministerio_${mesAnio.replace(" ", "_")}`,
  });

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg mb-2 bg-primary text-primary-foreground">
          <GraduationCap className="h-6 w-6" />
        </div>
        <CardTitle>Programa Vida y Ministerio{etiqueta ? ` (${etiqueta})` : ""}</CardTitle>
        <CardDescription>Programa mensual de la Reunión Vida y Ministerio Cristiano</CardDescription>

        <div className="mt-4 space-y-3">
          {programa ? (
            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium capitalize">{programa.periodo}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Actualizado:{" "}
                {format(new Date(programa.updated_at || programa.created_at), "d 'de' MMMM, yyyy 'a las' h:mm a", {
                  locale: es,
                })}
              </p>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" className="w-full gap-2">
                    <Eye className="h-4 w-4" />
                    Ver Programa
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-auto p-3">
                  <DialogHeader className="pb-2">
                    <DialogTitle className="capitalize">Vida y Ministerio - {programa.periodo}</DialogTitle>
                  </DialogHeader>
                  <div className="w-full">
                    <div className="overflow-auto max-h-[80vh]">
                      <div ref={printRef}>
                        <ImpresionVidaMinisterio
                          programas={programasVyMDelMes}
                          participantes={participantes || []}
                          congregacionNombre={congregacionNombre}
                          mesAnio={mesAnio}
                          horaInicio={horaInicio}
                          diaEntreSemana={diaEntreSemana}
                          consejoMaestrosMins={consejoMaestrosMins}
                        />
                      </div>
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
                    <Button variant="outline" onClick={() => onShare(programa, "Vida y Ministerio")} className="gap-2">
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
          ) : (
            <div className="bg-muted/30 p-3 rounded-lg text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {loadingPublicado ? "Cargando..." : "No hay programa publicado"}
              </p>
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
