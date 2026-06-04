import { useState } from "react";
import { format, startOfWeek, endOfWeek, parseISO, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ReunionPublicaSemanalProps {
  publico?: boolean;
  congregacionId?: string;
}

export function ReunionPublicaSemanal({ publico = false, congregacionId }: ReunionPublicaSemanalProps = {}) {
  const [semanaOffset, setSemanaOffset] = useState(0);
  const hoy = new Date();
  const semanaBase = semanaOffset === 0 ? hoy : addWeeks(hoy, semanaOffset);
  const inicioSemana = startOfWeek(semanaBase, { weekStartsOn: 1 });
  const finSemana = endOfWeek(semanaBase, { weekStartsOn: 1 });
  const inicioStr = format(inicioSemana, "yyyy-MM-dd");
  const finStr = format(finSemana, "yyyy-MM-dd");

  // Auth (siempre llamados; en modo público se pasa mes undefined para deshabilitar)
  const { programa: programaInicio, isLoading: loadingInicio } = useReunionPublica(
    publico ? undefined : inicioSemana.getMonth(),
    publico ? undefined : inicioSemana.getFullYear()
  );
  const cruzaMeses = inicioSemana.getMonth() !== finSemana.getMonth();
  const { programa: programaFin, isLoading: loadingFin } = useReunionPublica(
    !publico && cruzaMeses ? finSemana.getMonth() : undefined,
    !publico && cruzaMeses ? finSemana.getFullYear() : undefined
  );
  const { participantes: participantesAuth, isLoading: loadingParticipantes } = useParticipantes();

  // Public RPC
  const pubQuery = useQuery({
    queryKey: ["reunion-publica-publico", congregacionId, inicioStr, finStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_reunion_publica_publico_completo" as never,
        { _congregacion_id: congregacionId, _desde: inicioStr, _hasta: finStr } as never
      );
      if (error) throw error;
      return data as {
        programa: any[];
        participantes: Array<{ id: string; nombre: string; apellido: string }>;
      };
    },
    enabled: publico && !!congregacionId,
  });

  const participantes: any[] = publico ? (pubQuery.data?.participantes || []) : participantesAuth;
  const isLoading = publico
    ? pubQuery.isLoading
    : (loadingInicio || loadingParticipantes || (cruzaMeses && loadingFin));

  const todasLasEntradas: any[] = publico
    ? (pubQuery.data?.programa || [])
    : [...(programaInicio || []), ...(cruzaMeses && programaFin ? programaFin : [])];
  const entradasUnicas = Array.from(new Map(todasLasEntradas.map((e: any) => [e.id, e])).values());
  const entradasSemana = entradasUnicas.filter(
    (p: any) => p.fecha >= inicioStr && p.fecha <= finStr
  );


  const getNombre = (id: string | null) => {
    if (!id) return null;
    const p = participantes.find((p) => p.id === id);
    return p ? `${p.nombre} ${p.apellido}` : null;
  };

  const rangoLabel = inicioSemana.getMonth() === finSemana.getMonth()
    ? `${format(inicioSemana, "d")} – ${format(finSemana, "d 'de' MMMM", { locale: es })}`
    : `${format(inicioSemana, "d 'de' MMM", { locale: es })} – ${format(finSemana, "d 'de' MMM", { locale: es })}`;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg uppercase">
            <BookOpen className="h-5 w-5" />
            Reunión Pública
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg uppercase">
          <BookOpen className="h-5 w-5 text-primary" />
          Reunión Pública
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Navegación semanal */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSemanaOffset(prev => prev - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            className="text-sm font-medium lowercase hover:text-primary transition-colors"
            onClick={() => setSemanaOffset(0)}
            title="Volver a la semana actual"
          >
            {rangoLabel}
            {semanaOffset !== 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">(ir a hoy)</span>
            )}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSemanaOffset(prev => prev + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {entradasSemana.length === 0 ? (
          <div className="text-sm text-center py-2 text-muted-foreground">
            Sin programa esta semana
          </div>
        ) : (
          entradasSemana.map((entrada) => {
            const date = parseISO(entrada.fecha);
            const esHoy = format(hoy, "yyyy-MM-dd") === entrada.fecha;

            const presidente = getNombre(entrada.presidente_id);
            const oradorNombre = entrada.orador_nombre || getNombre(entrada.orador_id);
            const lector = getNombre(entrada.lector_atalaya_id);

            return (
              <div
                key={entrada.id}
                className={`border rounded-lg p-3 ${esHoy ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-bold uppercase ${esHoy ? "text-primary" : ""}`}>
                    {format(date, "EEEE", { locale: es })}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {format(date, "d 'de' MMMM", { locale: es })}
                  </span>
                  {esHoy && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Hoy
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  {presidente && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Presidente:</span>
                      <span>{presidente}</span>
                    </div>
                  )}

                  {oradorNombre && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Orador:</span>
                      <span>{oradorNombre}</span>
                      {entrada.orador_congregacion && (
                        <span className="text-muted-foreground">({entrada.orador_congregacion})</span>
                      )}
                    </div>
                  )}

                  {entrada.tema_discurso && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-muted-foreground">Tema:</span>
                      <span className="font-bold">{entrada.tema_discurso}</span>
                    </div>
                  )}

                  {lector && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Lector de La Atalaya:</span>
                      <span>{lector}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
