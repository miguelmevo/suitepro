import { FileText, Megaphone, BookOpen, Calendar, Eye, Loader2, Printer, Share2 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProgramasPublicados } from "@/hooks/useProgramasPublicados";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useMensajesAdicionales } from "@/hooks/useMensajesAdicionales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { ImpresionPrograma } from "@/components/programa/ImpresionPrograma";
import { ImpresionReunionPublica } from "@/components/reunion-publica/ImpresionReunionPublica";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, eachWeekOfInterval, getDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useRef, useMemo } from "react";
import { useReactToPrint } from "react-to-print";

const DIA_SEMANA_MAP: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

const ProgramasDelMes = () => {
  const { congregacionActual } = useCongregacion();
  
  // Predicación
  const { programaMesActual: programaPredicacion, isLoading: loadingProgramas } = useProgramasPublicados("predicacion");
  const [openPredicacion, setOpenPredicacion] = useState(false);
  const printRefPredicacion = useRef<HTMLDivElement>(null);

  // Reunión Pública
  const { programaMesActual: programaReunion, isLoading: loadingReunion } = useProgramasPublicados("reunion_publica");
  const [openReunion, setOpenReunion] = useState(false);
  const printRefReunion = useRef<HTMLDivElement>(null);

  const handlePrintPredicacion = useReactToPrint({
    contentRef: printRefPredicacion,
    documentTitle: "Programa de Predicación",
  });

  const handlePrintReunion = useReactToPrint({
    contentRef: printRefReunion,
    documentTitle: "Programa Reunión Pública",
  });

  const handleShare = async (programa: { pdf_url: string; periodo: string }, tipo: string) => {
    const shareData = {
      title: `${tipo} - ${programa.periodo}`,
      text: `${tipo} para ${programa.periodo}`,
      url: programa.pdf_url,
    };
    if (navigator.share && navigator.canShare(shareData)) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(programa.pdf_url);
      alert("Enlace copiado al portapapeles");
    }
  };

  // --- Datos para Predicación ---
  const fechaInicioPredicacion = programaPredicacion?.fecha_inicio || "";
  const fechaFinPredicacion = programaPredicacion?.fecha_fin || "";

  const { 
    programa: programaPred, 
    horarios,
    puntos,
    territorios,
    direccionesBloqueadas,
    isLoading: loadingProgramaPred 
  } = useProgramaPredicacion(fechaInicioPredicacion, fechaFinPredicacion);

  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { diasEspeciales } = useDiasEspeciales();
  const { mensajesAdicionales } = useMensajesAdicionales();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  const { grupos: gruposPredicacion, isLoading: loadingGrupos } = useGruposPredicacion();

  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as { dia_entre_semana?: string; hora_entre_semana?: string; dia_fin_semana?: string; hora_fin_semana?: string } | undefined;

  const fechasPredicacion = (): string[] => {
    if (!programaPredicacion) return [];
    try {
      const inicio = parseISO(programaPredicacion.fecha_inicio);
      const fin = parseISO(programaPredicacion.fecha_fin);
      return eachDayOfInterval({ start: inicio, end: fin }).map(d => format(d, "yyyy-MM-dd"));
    } catch { return []; }
  };

  const fechasPred = fechasPredicacion();
  const mesAnioPredicacion = programaPredicacion 
    ? format(parseISO(programaPredicacion.fecha_inicio), "MMMM yyyy", { locale: es }) : "";

  // --- Datos para Reunión Pública ---
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();
  
  const { programa: programaReunionData } = useReunionPublica(mesActual, anioActual);

  const diaFinSemanaStr = (diasReunionConfig as any)?.dia_fin_semana ?? "domingo";
  const diaReunionNum = DIA_SEMANA_MAP[diaFinSemanaStr] ?? 0;
  const colorTema = congregacionActual?.color_primario || "blue";

  const fechasReunion = useMemo(() => {
    const inicio = startOfMonth(new Date(anioActual, mesActual));
    const fin = endOfMonth(new Date(anioActual, mesActual));
    const semanas = eachWeekOfInterval({ start: inicio, end: fin }, { weekStartsOn: 1 });
    return semanas
      .map(semana => {
        const diff = (diaReunionNum - getDay(semana) + 7) % 7;
        return addDays(semana, diff);
      })
      .filter(fecha => fecha >= inicio && fecha <= fin);
  }, [mesActual, anioActual, diaReunionNum]);

  const mesAnioReunion = programaReunion 
    ? format(parseISO(programaReunion.fecha_inicio), "MMMM yyyy", { locale: es }) : "";

  const isLoadingPredicacion = loadingProgramaPred || loadingParticipantes || loadingConfig || loadingGrupos;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-primary">
          Programas del Mes
        </h1>
        <p className="text-muted-foreground">
          Consulta los programas publicados del mes en curso
        </p>
      </div>

      <div className="flex justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
          {/* Card Predicación */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg mb-2 bg-primary text-primary-foreground">
                <Megaphone className="h-6 w-6" />
              </div>
              <CardTitle>Programa de Predicación</CardTitle>
              <CardDescription>Programa mensual de predicación con horarios, territorios y capitanes</CardDescription>
              
              <div className="mt-4 space-y-3">
                {programaPredicacion ? (
                  <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium capitalize">{programaPredicacion.periodo}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Publicado: {format(new Date(programaPredicacion.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                    
                    <Dialog open={openPredicacion} onOpenChange={setOpenPredicacion}>
                      <DialogTrigger asChild>
                        <Button variant="default" className="w-full gap-2">
                          <Eye className="h-4 w-4" />
                          Ver Programa
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-auto p-3">
                        <DialogHeader className="pb-2">
                          <DialogTitle className="capitalize">
                            Programa de Predicación - {programaPredicacion.periodo}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                          {isLoadingPredicacion ? (
                            <div className="flex justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          ) : (
                            <div className="overflow-auto max-h-[80vh]">
                              <div ref={printRefPredicacion}>
                                <ImpresionPrograma
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
                                  mesAnio={mesAnioPredicacion}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            className="border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => setOpenPredicacion(false)}
                          >
                            Cerrar
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleShare(programaPredicacion, "Programa de Predicación")}
                            className="gap-2"
                          >
                            <Share2 className="h-4 w-4" />
                            Compartir
                          </Button>
                          <Button onClick={() => handlePrintPredicacion()} className="gap-2">
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
                      No hay programa publicado para el mes actual
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Card Reunión Pública */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg mb-2 bg-primary text-primary-foreground">
                <BookOpen className="h-6 w-6" />
              </div>
              <CardTitle>Programa Reunión Pública</CardTitle>
              <CardDescription>Programa mensual con oradores, temas y asignaciones semanales</CardDescription>
              
              <div className="mt-4 space-y-3">
                {programaReunion ? (
                  <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium capitalize">{programaReunion.periodo}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Publicado: {format(new Date(programaReunion.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                    
                    <Dialog open={openReunion} onOpenChange={setOpenReunion}>
                      <DialogTrigger asChild>
                        <Button variant="default" className="w-full gap-2">
                          <Eye className="h-4 w-4" />
                          Ver Programa
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-auto p-3">
                        <DialogHeader className="pb-2">
                          <DialogTitle className="capitalize">
                            Programa Reunión Pública - {programaReunion.periodo}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="overflow-auto max-h-[80vh]">
                          <div ref={printRefReunion}>
                            <ImpresionReunionPublica
                              programa={programaReunionData || []}
                              participantes={participantes || []}
                              fechas={fechasReunion}
                              congregacionNombre={congregacionActual?.nombre || ""}
                              mesAnio={mesAnioReunion}
                              colorTema={colorTema}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            className="border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => setOpenReunion(false)}
                          >
                            Cerrar
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleShare(programaReunion, "Programa Reunión Pública")}
                            className="gap-2"
                          >
                            <Share2 className="h-4 w-4" />
                            Compartir
                          </Button>
                          <Button onClick={() => handlePrintReunion()} className="gap-2">
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
                      No hay programa publicado para el mes actual
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Los programas publicados por los administradores aparecerán aquí para su consulta.</p>
      </div>
    </div>
  );
};

export default ProgramasDelMes;
