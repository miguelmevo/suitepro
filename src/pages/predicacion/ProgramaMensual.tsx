import { useState, useRef } from "react";
import { format, startOfMonth, endOfMonth, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Printer, Upload, Settings, Trash2, UserCheck } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { ProgramaTable } from "@/components/programa/ProgramaTable";
import { PeriodoSelector } from "@/components/programa/PeriodoSelector";
import { ConfiguracionModal } from "@/components/programa/ConfiguracionModal";
import { ImpresionPrograma } from "@/components/programa/ImpresionPrograma";
import { AsignacionCapitanesModal } from "@/components/programa/AsignacionCapitanesModal";
import { LimpiarProgramaModal } from "@/components/programa/LimpiarProgramaModal";
import { PublicarProgramaModal } from "@/components/programa/PublicarProgramaModal";
import { CierreProgramaModal } from "@/components/programa/CierreProgramaModal";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useProgramasPublicados } from "@/hooks/useProgramasPublicados";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useMensajesAdicionales } from "@/hooks/useMensajesAdicionales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { PeriodoPrograma } from "@/types/programa-predicacion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function ProgramaMensual() {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState<PeriodoPrograma>("mensual");
  const [fechaInicio, setFechaInicio] = useState<Date>(startOfMonth(hoy));
  const [fechaFin, setFechaFin] = useState<Date>(endOfMonth(hoy));
  
  const printRef = useRef<HTMLDivElement>(null);

  const fechaInicioStr = format(fechaInicio, "yyyy-MM-dd");
  const fechaFinStr = format(fechaFin, "yyyy-MM-dd");
  const mesAnio = format(fechaInicio, "MMMM yyyy", { locale: es });

  // Verificar si el mes seleccionado es anterior al mes actual
  const mesActual = startOfMonth(hoy);
  const esMesAnterior = isBefore(fechaFin, mesActual);
  const esReadOnly = esMesAnterior;

  const { 
    programa, 
    horarios,
    puntos,
    territorios,
    isLoading: loadingPrograma, 
    crearEntrada,
    actualizarEntrada,
    eliminarEntrada,
    limpiarPrograma,
  } = useProgramaPredicacion(fechaInicioStr, fechaFinStr);

  const { 
    crearHorario,
    actualizarHorario,
    eliminarHorario,
    crearPuntoEncuentro,
    crearTerritorio,
    isLoading: loadingCatalogos 
  } = useCatalogos();

  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { diasEspeciales, crearDiaEspecial, eliminarDiaEspecial } = useDiasEspeciales();
  const { mensajesAdicionales, crearMensaje, eliminarMensaje } = useMensajesAdicionales();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  const { grupos: gruposPredicacion, isLoading: loadingGrupos } = useGruposPredicacion();
  const { programas, cerrarPrograma, reabrirPrograma } = useProgramasPublicados();
  
  // Obtener el programa publicado para el mes seleccionado
  const programaPublicado = programas.find(
    (p) => p.tipo_programa === "predicacion" && 
           p.fecha_inicio === fechaInicioStr && 
           p.fecha_fin === fechaFinStr
  );

  // Verificar si el programa está cerrado
  const estaCerrado = programaPublicado?.cerrado ?? false;

  // Obtener configuración de días de reunión
  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as { dia_entre_semana?: string; hora_entre_semana?: string; dia_fin_semana?: string; hora_fin_semana?: string } | undefined;

  const isLoading = loadingPrograma || loadingCatalogos || loadingParticipantes || loadingConfig || loadingGrupos;

  // Imprimir usando react-to-print
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Programa_Predicacion_${mesAnio.replace(" ", "_")}`,
  });

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
        <TooltipProvider>
          <div className="flex gap-2 flex-wrap">
            {!esReadOnly && !estaCerrado && (
              <>
                <LimpiarProgramaModal
                  onLimpiar={(tipo) => limpiarPrograma.mutate({ tipo, ids: programa.map((p) => p.id) })}
                  isPending={limpiarPrograma.isPending}
                  cantidadEntradas={programa.length}
                />
                <AsignacionCapitanesModal
                  horarios={horarios}
                  programa={programa}
                  fechas={fechas}
                  diasEspeciales={diasEspeciales}
                  diasReunionConfig={diasReunionConfig}
                  onActualizarEntrada={(id, data) => actualizarEntrada.mutate({ id, ...data })}
                  onCrearEntrada={(data) => crearEntrada.mutate(data)}
                />
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handlePrint()}
                  disabled={isLoading}
                  className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-600"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Imprimir PDF</TooltipContent>
            </Tooltip>
            {!estaCerrado && (
              <PublicarProgramaModal
                tipoProgramaId="predicacion"
                tipoProgramaNombre="Programa de Predicación"
                programaPublicado={programaPublicado}
              />
            )}
            <CierreProgramaModal
              programaPublicado={programaPublicado}
              onCerrar={() => programaPublicado && cerrarPrograma.mutate(programaPublicado.id)}
              onReabrir={() => programaPublicado && reabrirPrograma.mutate(programaPublicado.id)}
              isPendingCerrar={cerrarPrograma.isPending}
              isPendingReabrir={reabrirPrograma.isPending}
              onPublicarPrimero={() => {}}
            />
            <ConfiguracionModal 
              horarios={horarios}
              puntos={puntos}
              territorios={territorios}
              diasEspeciales={diasEspeciales}
              onCrearHorario={(data) => crearHorario.mutate(data)}
              onActualizarHorario={(data) => actualizarHorario.mutate(data)}
              onEliminarHorario={(id) => eliminarHorario.mutate(id)}
              onCrearPunto={(data) => crearPuntoEncuentro.mutate(data)}
              onCrearTerritorio={(data) => crearTerritorio.mutate(data)}
              onCrearDiaEspecial={(data) => crearDiaEspecial.mutate(data)}
              onEliminarDiaEspecial={(id) => eliminarDiaEspecial.mutate(id)}
              isLoading={crearHorario.isPending || crearPuntoEncuentro.isPending || crearTerritorio.isPending}
            />
          </div>
        </TooltipProvider>
      </div>

      {/* Componente oculto para impresión */}
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
          mensajesAdicionales={mensajesAdicionales}
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

      {esMesAnterior && (
        <Alert className="bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Este programa es de un mes anterior y no puede ser modificado.
          </AlertDescription>
        </Alert>
      )}

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
          mensajesAdicionales={mensajesAdicionales}
          onCrearEntrada={(data) => crearEntrada.mutate(data)}
          onActualizarEntrada={(id, data) => actualizarEntrada.mutate({ id, ...data })}
          onEliminarEntrada={(id) => eliminarEntrada.mutate(id)}
          onCrearMensajeAdicional={(data) => crearMensaje.mutate(data)}
          onEliminarMensajeAdicional={(id) => eliminarMensaje.mutate(id)}
          isCreating={crearEntrada.isPending}
          diasReunionConfig={diasReunionConfig}
          readOnly={esMesAnterior}
        />
      )}
    </div>
  );
}
