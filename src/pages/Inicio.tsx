import { FileText, Megaphone, Calendar, Eye, Loader2 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProgramasPublicados } from "@/hooks/useProgramasPublicados";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useMensajesAdicionales } from "@/hooks/useMensajesAdicionales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { ImpresionPrograma } from "@/components/programa/ImpresionPrograma";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

const Inicio = () => {
  const { programas, isLoading } = useProgramasPublicados();
  const [openModal, setOpenModal] = useState(false);

  // Obtener el programa publicado más reciente de predicación
  const programaPredicacion = programas.find((p) => p.tipo_programa === "predicacion");

  // Cargar datos del programa cuando hay uno publicado
  const fechaInicioStr = programaPredicacion?.fecha_inicio || "";
  const fechaFinStr = programaPredicacion?.fecha_fin || "";

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

  // Obtener configuración de días de reunión
  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as { dia_entre_semana?: string; hora_entre_semana?: string; dia_fin_semana?: string; hora_fin_semana?: string } | undefined;

  // Generar fechas del período
  const generarFechas = (): string[] => {
    if (!programaPredicacion) return [];
    try {
      const inicio = parseISO(programaPredicacion.fecha_inicio);
      const fin = parseISO(programaPredicacion.fecha_fin);
      return eachDayOfInterval({ start: inicio, end: fin }).map(d => format(d, "yyyy-MM-dd"));
    } catch {
      return [];
    }
  };

  const fechas = generarFechas();
  const mesAnio = programaPredicacion 
    ? format(parseISO(programaPredicacion.fecha_inicio), "MMMM yyyy", { locale: es })
    : "";

  const isLoadingData = loadingPrograma || loadingParticipantes || loadingConfig || loadingGrupos;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-primary">
          PROGRAMAS PUBLICADOS
        </h1>
        <p className="text-muted-foreground text-lg">
          Consulta los programas disponibles
        </p>
      </div>

      <div className="flex justify-center">
        <Card className="hover:shadow-lg transition-shadow max-w-md w-full">
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
                  
                  <Dialog open={openModal} onOpenChange={setOpenModal}>
                    <DialogTrigger asChild>
                      <Button variant="default" className="w-full gap-2">
                        <Eye className="h-4 w-4" />
                        Ver Programa
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl max-h-[95vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle className="capitalize">
                          Programa de Predicación - {programaPredicacion.periodo}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="w-full">
                        {isLoadingData ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="border rounded-lg overflow-auto max-h-[70vh]">
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
                        )}
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setOpenModal(false)}>
                          Cerrar
                        </Button>
                        <Button asChild>
                          <a href={programaPredicacion.pdf_url} target="_blank" rel="noopener noreferrer" download>
                            Descargar PDF
                          </a>
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="bg-muted/30 p-3 rounded-lg text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Sin programas publicados</p>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Los programas publicados por los administradores aparecerán aquí para su consulta.</p>
      </div>
    </div>
  );
};

export default Inicio;
