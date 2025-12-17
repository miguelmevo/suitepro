import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Loader2 } from "lucide-react";
import { ProgramaTable } from "@/components/programa/ProgramaTable";
import { PeriodoSelector } from "@/components/programa/PeriodoSelector";
import { ConfiguracionModal } from "@/components/programa/ConfiguracionModal";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { PeriodoPrograma } from "@/types/programa-predicacion";

export default function ProgramaMensual() {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState<PeriodoPrograma>("mensual");
  const [fechaInicio, setFechaInicio] = useState<Date>(startOfMonth(hoy));
  const [fechaFin, setFechaFin] = useState<Date>(endOfMonth(hoy));

  const fechaInicioStr = format(fechaInicio, "yyyy-MM-dd");
  const fechaFinStr = format(fechaFin, "yyyy-MM-dd");

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

  // Obtener configuración de días de reunión
  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as { dia_entre_semana?: string; hora_entre_semana?: string; dia_fin_semana?: string; hora_fin_semana?: string } | undefined;

  const isLoading = loadingPrograma || loadingCatalogos || loadingParticipantes || loadingConfig;

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