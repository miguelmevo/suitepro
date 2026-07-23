import { useRef, useState, useMemo } from "react";
import { useReactToPrint } from "react-to-print";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Calendar, Eye, Loader2, Printer, Share2, Sparkles } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ImpresionAsignacionesServicioWrapper,
  type FormatoImpresionAsignaciones,
} from "@/components/asignaciones-servicio/ImpresionAsignacionesServicioWrapper";
import {
  useAsignacionesServicio,
  getMeetingDatesForMonth,
  TIPOS_ASIGNACION_SERVICIO,
} from "@/hooks/useAsignacionesServicio";
import { useAsignacionesServicioDiasEspeciales } from "@/hooks/useAsignacionesServicioDiasEspeciales";
import { useMensajesAdicionales } from "@/hooks/useMensajesAdicionales";
import type { ProgramaPublicado } from "@/hooks/useProgramasPublicados";

interface BloqueProps {
  programa: ProgramaPublicado;
  etiquetaBoton: string;
  participantes: any[];
  gruposPredicacion: any[];
  congregacionNombre: string;
  colorTema: string;
  formato: FormatoImpresionAsignaciones;
  diaEntreSemana: string;
  diaFinSemana: string;
  loadingBase?: boolean;
  onShare: (programa: { pdf_url: string; periodo: string }, tipo: string) => void;
}

function BloquePrograma({
  programa,
  etiquetaBoton,
  participantes,
  gruposPredicacion,
  congregacionNombre,
  colorTema,
  formato,
  diaEntreSemana,
  diaFinSemana,
  loadingBase,
  onShare,
}: BloqueProps) {
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fechaBase = parseISO(programa.fecha_inicio);
  const mes = fechaBase.getMonth();
  const anio = fechaBase.getFullYear();

  const fechasAsignaciones = useMemo(
    () => getMeetingDatesForMonth(anio, mes, diaEntreSemana || "martes", diaFinSemana || "domingo"),
    [anio, mes, diaEntreSemana, diaFinSemana],
  );
  const { asignaciones: asignacionesServicio, isLoading: loadingAsignacionesServicio } = useAsignacionesServicio(
    anio,
    mes,
  );
  const { diasEspecialesAsignados: diasEspecialesAsig } = useAsignacionesServicioDiasEspeciales(anio, mes);
  const { mensajesAdicionales: mensajesAsig } = useMensajesAdicionales("asignaciones_servicio");
  const tiposAsignaciones = useMemo(() => TIPOS_ASIGNACION_SERVICIO, []);
  const mesAnio = format(fechaBase, "MMMM yyyy", { locale: es });

  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: "Asignaciones de Servicio" });

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
            <DialogTitle className="capitalize">Asignaciones de Servicio - {programa.periodo}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[80vh]">
            {loadingAsignacionesServicio || loadingBase ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div ref={printRef}>
                <ImpresionAsignacionesServicioWrapper
                  formato={formato}
                  fechasReunion={fechasAsignaciones}
                  tipos={tiposAsignaciones}
                  asignaciones={asignacionesServicio}
                  participantes={participantes || []}
                  grupos={gruposPredicacion || []}
                  congregacionNombre={congregacionNombre}
                  mesAnio={mesAnio}
                  colorTema={colorTema}
                  diasEspeciales={diasEspecialesAsig}
                  mensajesAdicionales={mensajesAsig}
                />
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
            <Button variant="outline" onClick={() => onShare(programa, "Asignaciones de Servicio")} className="gap-2">
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
  congregacionNombre: string;
  colorTema: string;
  formato: FormatoImpresionAsignaciones;
  diaEntreSemana: string;
  diaFinSemana: string;
  loadingBase?: boolean;
  onShare: (programa: { pdf_url: string; periodo: string }, tipo: string) => void;
}

export function CardProgramaAsignaciones({
  programa,
  programaSiguiente,
  loadingPublicado,
  participantes,
  gruposPredicacion,
  congregacionNombre,
  colorTema,
  formato,
  diaEntreSemana,
  diaFinSemana,
  loadingBase,
  onShare,
}: Props) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg mb-2 bg-primary text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <CardTitle>Asignaciones de Servicio</CardTitle>
        <CardDescription>Programa mensual con audio, video, micrófonos, aseo y hospitalidad</CardDescription>

        <div className="mt-4 space-y-3">
          {programa ? (
            <BloquePrograma
              programa={programa}
              etiquetaBoton="Ver Programa"
              participantes={participantes}
              gruposPredicacion={gruposPredicacion}
              congregacionNombre={congregacionNombre}
              colorTema={colorTema}
              formato={formato}
              diaEntreSemana={diaEntreSemana}
              diaFinSemana={diaFinSemana}
              loadingBase={loadingBase}
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
              congregacionNombre={congregacionNombre}
              colorTema={colorTema}
              formato={formato}
              diaEntreSemana={diaEntreSemana}
              diaFinSemana={diaFinSemana}
              loadingBase={loadingBase}
              onShare={onShare}
            />
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
