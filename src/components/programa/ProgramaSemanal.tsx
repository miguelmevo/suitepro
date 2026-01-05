import { format, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users, ExternalLink } from "lucide-react";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { TerritorioLink } from "@/components/programa/TerritorioLink";
import { Skeleton } from "@/components/ui/skeleton";

interface DiasReunionConfig {
  dia_entre_semana?: string;
  hora_entre_semana?: string;
  dia_fin_semana?: string;
  hora_fin_semana?: string;
}

export function ProgramaSemanal() {
  const hoy = new Date();
  const fechaInicio = format(hoy, "yyyy-MM-dd");
  const fechaFin = format(addDays(hoy, 1), "yyyy-MM-dd");

  const { programa, horarios, puntos, territorios, isLoading: loadingPrograma } = useProgramaPredicacion(fechaInicio, fechaFin);
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { diasEspeciales } = useDiasEspeciales();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  const { grupos: gruposPredicacion } = useGruposPredicacion();

  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as DiasReunionConfig | undefined;

  const isLoading = loadingPrograma || loadingParticipantes || loadingConfig;

  // Generar array de 2 días desde hoy (hoy y mañana)
  const fechas = Array.from({ length: 2 }, (_, i) => format(addDays(hoy, i), "yyyy-MM-dd"));

  // Clasificar horarios por mañana/tarde
  const clasificarHorario = (horarioId: string): "manana" | "tarde" => {
    const horario = horarios.find(h => h.id === horarioId);
    if (!horario) return "manana";
    const nombreLower = horario.nombre.toLowerCase();
    if (nombreLower.includes("mañana") || nombreLower.includes("manana")) return "manana";
    if (nombreLower.includes("tarde")) return "tarde";
    const hora = parseInt(horario.hora.split(":")[0], 10);
    return hora < 12 ? "manana" : "tarde";
  };

  // Obtener mensaje de reunión para una fecha
  const getMensajeReunion = (fecha: string): { mensaje: string; hora: string } | null => {
    if (!diasReunionConfig) return null;
    
    const date = parseISO(fecha);
    const diaSemana = format(date, "EEEE", { locale: es }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const normalizar = (dia: string) => dia?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
    
    const diaEntreSemana = normalizar(diasReunionConfig.dia_entre_semana || "");
    const diaFinSemana = normalizar(diasReunionConfig.dia_fin_semana || "");
    
    if (diaSemana === diaEntreSemana) {
      return {
        mensaje: "Reunión Vida y Ministerio Cristiano",
        hora: diasReunionConfig.hora_entre_semana || "19:30"
      };
    }
    
    if (diaSemana === diaFinSemana) {
      return {
        mensaje: "Reunión Pública",
        hora: diasReunionConfig.hora_fin_semana || "18:00"
      };
    }
    
    return null;
  };

  // Verificar si es un día especial bloqueado
  const getDiaEspecial = (fecha: string) => {
    // diasEspeciales puede tener campo fecha desde la base de datos
    return diasEspeciales?.find(d => (d as any).fecha === fecha && d.bloqueo_tipo === "completo");
  };

  // Renderizar entrada de programa
  const renderEntrada = (entrada: typeof programa[0]) => {
    const horario = horarios.find(h => h.id === entrada.horario_id);
    const punto = puntos.find(p => p.id === entrada.punto_encuentro_id);
    const capitan = participantes.find(p => p.id === entrada.capitan_id);
    
    const esZoom = punto?.nombre?.toLowerCase().includes("zoom") || false;
    
    // Manejar territorios múltiples
    const territorioIds = entrada.territorio_ids?.length 
      ? entrada.territorio_ids 
      : entrada.territorio_id 
        ? [entrada.territorio_id] 
        : [];

    // Si es por grupos
    if (entrada.es_por_grupos && entrada.asignaciones_grupos) {
      const asignaciones = entrada.asignaciones_grupos;
      
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">{horario?.hora.slice(0, 5)}</span>
          </div>
          <div className="space-y-1.5">
            {asignaciones.map((asig, idx) => {
              const grupo = gruposPredicacion?.find(g => g.id === asig.grupo_id);
              const terrId = asig.territorio_id;
              const cap = asig.capitan_id ? participantes.find(p => p.id === asig.capitan_id) : null;
              
              return (
                <div key={idx} className="text-xs bg-muted/50 rounded p-1.5">
                  <span className="font-medium">G{grupo?.numero}: </span>
                  {terrId && (
                    <span className="mr-2">
                      Terr. <TerritorioLink territorioIds={[terrId]} territorios={territorios} className="text-xs" />
                    </span>
                  )}
                  {cap && <span className="text-muted-foreground">({cap.nombre} {cap.apellido})</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{horario?.hora.slice(0, 5)}</span>
        </div>
        
        {punto && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <span className="font-medium">{punto.nombre}</span>
              {punto.direccion && !esZoom && (
                <div className="text-xs text-muted-foreground">
                  {punto.url_maps ? (
                    <a 
                      href={punto.url_maps} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {punto.direccion}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    punto.direccion
                  )}
                </div>
              )}
              {esZoom && punto.url_maps && (
                <div className="text-xs">
                  <a 
                    href={punto.url_maps} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Unirse a Zoom
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
        
        {territorioIds.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs">Territorio:</span>
            <TerritorioLink territorioIds={territorioIds} territorios={territorios} className="text-sm" />
          </div>
        )}
        
        {capitan && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs">Capitán: {capitan.nombre} {capitan.apellido}</span>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          Predicación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

return (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Calendar className="h-5 w-5 text-primary" />
        Predicación
      </CardTitle>
    </CardHeader>
      <CardContent className="space-y-3">
        {fechas.map(fecha => {
          const date = parseISO(fecha);
          const esHoy = format(hoy, "yyyy-MM-dd") === fecha;
          const diaEspecial = getDiaEspecial(fecha);
          const reunion = getMensajeReunion(fecha);
          
          // Obtener entradas del programa para esta fecha
          const entradasDelDia = programa.filter(p => p.fecha === fecha);
          
          // Separar por mañana/tarde
          const entradasManana = entradasDelDia.filter(e => 
            e.horario_id && clasificarHorario(e.horario_id) === "manana" && !e.es_mensaje_especial
          );
          const entradasTarde = entradasDelDia.filter(e => 
            e.horario_id && clasificarHorario(e.horario_id) === "tarde" && !e.es_mensaje_especial
          );
          const mensajeEspecial = entradasDelDia.find(e => e.es_mensaje_especial);

          const tieneProgramacion = entradasManana.length > 0 || entradasTarde.length > 0 || mensajeEspecial || diaEspecial || reunion;

          return (
            <div 
              key={fecha} 
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

              {diaEspecial ? (
                <div className="text-sm text-center py-2 font-medium text-muted-foreground">
                  {diaEspecial.nombre}
                </div>
              ) : mensajeEspecial ? (
                <div className="text-sm text-center py-2 font-medium" style={{ color: "#1e3a5f" }}>
                  {mensajeEspecial.mensaje_especial}
                </div>
              ) : !tieneProgramacion ? (
                <div className="text-sm text-center py-2 text-muted-foreground">
                  Sin programación
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* Columna izquierda: Entradas de mañana */}
                  <div className="space-y-2">
                    {entradasManana.length > 0 && (
                      <>
                        <span className="text-xs font-medium text-muted-foreground uppercase">Mañana</span>
                        {entradasManana.map(entrada => (
                          <div key={entrada.id} className="pl-2 border-l-2 border-primary/30">
                            {renderEntrada(entrada)}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  
                  {/* Columna derecha: Tarde o Reunión - con línea divisoria */}
                  <div className="border-l border-muted-foreground/30 pl-4 flex flex-col justify-center">
                    {/* Entradas de tarde */}
                    {entradasTarde.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase">Tarde</span>
                        {entradasTarde.map(entrada => (
                          <div key={entrada.id} className="pl-2 border-l-2 border-primary/30">
                            {renderEntrada(entrada)}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Reunión centrada verticalmente - solo si no hay entradas de tarde */}
                    {reunion && entradasTarde.length === 0 && (
                      <div className="flex items-center justify-center py-4">
                        <div className="text-sm text-center pl-2 border-l-2 border-primary/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{reunion.hora}</span>
                          </div>
                          <span className="text-muted-foreground">{reunion.mensaje}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Si hay entradas de tarde y también reunión */}
                    {reunion && entradasTarde.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-muted-foreground/20">
                        <div className="text-sm text-center pl-2 border-l-2 border-primary/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{reunion.hora}</span>
                          </div>
                          <span className="text-muted-foreground">{reunion.mensaje}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
