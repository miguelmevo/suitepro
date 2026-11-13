import { useState } from "react";
import { format, startOfWeek, endOfWeek, parseISO, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useReunionPublicaDiasEspeciales } from "@/hooks/useReunionPublicaDiasEspeciales";
import { textoContraste } from "@/components/reunion-publica/ImpresionReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ReunionPublicaSemanalProps {
  publico?: boolean;
  congregacionId?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ReunionPublicaSemanal({ publico = false, congregacionId, isOpen, onToggle }: ReunionPublicaSemanalProps = {}) {
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [colapsadoInterno, setColapsadoInterno] = useState(true);
  const colapsado = onToggle ? !isOpen : colapsadoInterno;
  const toggleColapsado = onToggle ?? (() => setColapsadoInterno((v) => !v));
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
  // Días especiales (motivos) de la semana: logueado por hook, público por la RPC.
  const { diasEspecialesAsignados: diasEspInicio } = useReunionPublicaDiasEspeciales(
    publico ? undefined : inicioSemana.getFullYear(),
    publico ? undefined : inicioSemana.getMonth()
  );
  const { diasEspecialesAsignados: diasEspFin } = useReunionPublicaDiasEspeciales(
    !publico && cruzaMeses ? finSemana.getFullYear() : undefined,
    !publico && cruzaMeses ? finSemana.getMonth() : undefined
  );

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
        dias_especiales?: Array<{ fecha: string; slot: number; mensaje: string; color: string }>;
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


  const diasEspecialesSemana: Array<{ fecha: string; slot: number; mensaje: string; color: string }> = (
    publico ? (pubQuery.data?.dias_especiales || []) : [...diasEspInicio, ...diasEspFin]
  )
    .filter((d) => d.fecha >= inicioStr && d.fecha <= finStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.slot - b.slot);
  const fechasConEspecial = Array.from(new Set(diasEspecialesSemana.map((d) => d.fecha)));
  const fechasDia = Array.from(
    new Set([...entradasSemana.map((e: any) => e.fecha as string), ...fechasConEspecial])
  ).sort();

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
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={toggleColapsado}>
        <CardTitle className="flex items-center justify-between gap-2 text-lg uppercase">
          <span className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Reunión Pública
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 -mr-1 normal-case pointer-events-none"
            aria-label={colapsado ? "Expandir" : "Colapsar"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${colapsado ? "" : "rotate-180"}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      {!colapsado && (
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

        {fechasDia.length === 0 ? (
          <div className="text-sm text-center py-2 text-muted-foreground">
            Sin programa esta semana
          </div>
        ) : (
          fechasDia.map((fechaDia) => {
            const entrada = entradasSemana.find((e: any) => e.fecha === fechaDia);
            const motivos = diasEspecialesSemana.filter((d) => d.fecha === fechaDia);
            const date = parseISO(fechaDia);
            const esHoy = format(hoy, "yyyy-MM-dd") === fechaDia;

            const presidente = entrada ? getNombre(entrada.presidente_id) : null;
            const oradorNombre = entrada ? (entrada.orador_nombre || getNombre(entrada.orador_id)) : null;
            const lector = entrada ? getNombre(entrada.lector_atalaya_id) : null;

            return (
              <div
                key={fechaDia}
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

                {motivos.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {motivos.map((m) => (
                      <div
                        key={m.slot}
                        className="rounded px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide"
                        style={{ background: m.color, color: textoContraste(m.color) }}
                      >
                        {m.mensaje}
                      </div>
                    ))}
                  </div>
                )}

                {entrada && (
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
                )}
              </div>
            );
          })
        )}
      </CardContent>
      )}
    </Card>
  );
}
