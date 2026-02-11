import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { Skeleton } from "@/components/ui/skeleton";

export function ReunionPublicaSemanal() {
  const hoy = new Date();
  const inicioSemana = startOfWeek(hoy, { weekStartsOn: 1 });
  const finSemana = endOfWeek(hoy, { weekStartsOn: 1 });

  const { programa, isLoading: loadingPrograma } = useReunionPublica(hoy.getMonth(), hoy.getFullYear());
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();

  const isLoading = loadingPrograma || loadingParticipantes;

  // Filtrar entradas de esta semana
  const inicioStr = format(inicioSemana, "yyyy-MM-dd");
  const finStr = format(finSemana, "yyyy-MM-dd");
  const entradasSemana = programa?.filter(
    (p) => p.fecha >= inicioStr && p.fecha <= finStr
  ) || [];

  const getNombre = (id: string | null) => {
    if (!id) return null;
    const p = participantes.find((p) => p.id === id);
    return p ? `${p.nombre} ${p.apellido}` : null;
  };

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
            const oradorSuplente = getNombre(entrada.orador_suplente_id);
            const oradorSaliente = getNombre(entrada.orador_saliente_id);
            const conductor = getNombre(entrada.conductor_atalaya_id);
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

                <div className="space-y-1 text-xs">
                  {entrada.tema_discurso && (
                    <div className="font-bold text-sm mb-1">
                      {entrada.tema_discurso}
                    </div>
                  )}
                  
                  {presidente && (
                    <div>
                      <span className="text-muted-foreground">Presidente: </span>
                      <span>{presidente}</span>
                    </div>
                  )}
                  
                  {oradorNombre && (
                    <div>
                      <span className="text-muted-foreground">Orador: </span>
                      <span>{oradorNombre}</span>
                      {entrada.orador_congregacion && (
                        <span className="text-muted-foreground"> ({entrada.orador_congregacion})</span>
                      )}
                    </div>
                  )}
                  
                  {conductor && (
                    <div>
                      <span className="text-muted-foreground">Conductor Atalaya: </span>
                      <span>{conductor}</span>
                    </div>
                  )}
                  
                  {lector && (
                    <div>
                      <span className="text-muted-foreground">Lector Atalaya: </span>
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
