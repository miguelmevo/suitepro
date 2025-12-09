import { useState, useMemo } from "react";
import { format, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { Calendar, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useCatalogos } from "@/hooks/useCatalogos";
import { PeriodoSelector } from "@/components/programa/PeriodoSelector";
import { ProgramaTable } from "@/components/programa/ProgramaTable";
import { EntradaFormModal } from "@/components/programa/EntradaFormModal";
import { ConfiguracionModal } from "@/components/programa/ConfiguracionModal";
import { PeriodoPrograma } from "@/types/programa-predicacion";

export default function ProgramaPredicacion() {
  const [periodo, setPeriodo] = useState<PeriodoPrograma>("semanal");
  const [fechaInicio, setFechaInicio] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [fechaFin, setFechaFin] = useState(() => endOfWeek(new Date(), { weekStartsOn: 1 }));

  const fechaInicioStr = format(fechaInicio, "yyyy-MM-dd");
  const fechaFinStr = format(fechaFin, "yyyy-MM-dd");

  const { programa, horarios, puntos, territorios, isLoading, crearEntrada } = useProgramaPredicacion(
    fechaInicioStr,
    fechaFinStr
  );
  const { participantes } = useParticipantes();
  const { crearHorario, crearPuntoEncuentro, crearTerritorio } = useCatalogos();

  const fechasDelPeriodo = useMemo(() => {
    return eachDayOfInterval({ start: fechaInicio, end: fechaFin }).map((d) => format(d, "yyyy-MM-dd"));
  }, [fechaInicio, fechaFin]);

  const handleFechasChange = (inicio: Date, fin: Date) => {
    setFechaInicio(inicio);
    setFechaFin(fin);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card print:hidden">
        <div className="container py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">Programa de Predicación</h1>
                <p className="text-sm text-muted-foreground">
                  Organiza las salidas de predicación
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ConfiguracionModal
                horarios={horarios}
                puntos={puntos}
                territorios={territorios}
                onCrearHorario={(d) => crearHorario.mutate(d)}
                onCrearPunto={(d) => crearPuntoEncuentro.mutate(d)}
                onCrearTerritorio={(d) => crearTerritorio.mutate(d)}
                isLoading={crearHorario.isPending || crearPuntoEncuentro.isPending || crearTerritorio.isPending}
              />
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-1" />
                Imprimir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="flex flex-col gap-4 mb-6 print:hidden">
          <PeriodoSelector
            periodo={periodo}
            onPeriodoChange={setPeriodo}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            onFechasChange={handleFechasChange}
          />

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Agregar entrada para fecha:</span>
            <div className="flex flex-wrap gap-2">
              {fechasDelPeriodo.slice(0, 7).map((fecha) => (
                <EntradaFormModal
                  key={fecha}
                  fecha={new Date(fecha + "T12:00:00")}
                  horarios={horarios}
                  puntos={puntos}
                  territorios={territorios}
                  participantes={participantes}
                  onSubmit={(data) => crearEntrada.mutate(data)}
                  isLoading={crearEntrada.isPending}
                />
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ProgramaTable programa={programa} horarios={horarios} fechas={fechasDelPeriodo} />
        )}
      </main>
    </div>
  );
}
