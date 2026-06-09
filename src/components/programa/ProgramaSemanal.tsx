import { useState, useMemo, useEffect } from "react";
import { format, addDays, parseISO, startOfMonth, endOfMonth, addMonths, differenceInCalendarDays, isBefore, isAfter, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, ExternalLink, Users, Navigation, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { TerritorioLink } from "@/components/programa/TerritorioLink";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

interface DiasReunionConfig {
  dia_entre_semana?: string;
  hora_entre_semana?: string;
  dia_fin_semana?: string;
  hora_fin_semana?: string;
  zoom_entre_semana?: string;
  zoom_fin_semana?: string;
}

interface ProgramaSemanalProps {
  /** Modo público (sin sesión) — usa RPC pública. */
  publico?: boolean;
  /** Requerido en modo público: id de la congregación. */
  congregacionId?: string;
}

// ===== Hook interno que selecciona la fuente de datos según modo =====
function useDatosPrograma(publico: boolean, congregacionId: string | undefined, fechaInicio: string, fechaFin: string) {
  // --- Modo autenticado (siempre se llaman para mantener orden de hooks) ---
  const auth = useProgramaPredicacion(publico ? "" : fechaInicio, publico ? "" : fechaFin);
  const { participantes } = useParticipantes();
  const { diasEspeciales: diasEspecialesAuth } = useDiasEspeciales();
  const { configuraciones: configsAuth, isLoading: loadingConfigAuth } = useConfiguracionSistema("general");
  const { grupos: gruposAuth } = useGruposPredicacion();

  // --- Modo público (RPC) ---
  const pubQuery = useQuery({
    queryKey: ["predicacion-publico", congregacionId, fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_predicacion_publico_completo" as never,
        { _congregacion_id: congregacionId, _desde: fechaInicio, _hasta: fechaFin } as never
      );
      if (error) throw error;
      return data as {
        programa: Array<Record<string, unknown>>;
        horarios: Array<Record<string, unknown>>;
        puntos: Array<Record<string, unknown>>;
        territorios: Array<Record<string, unknown>>;
        grupos_predicacion: Array<Record<string, unknown>>;
        dias_especiales: Array<Record<string, unknown>>;
        configuracion_general: Array<Record<string, unknown>>;
        mensajes_adicionales: Array<Record<string, unknown>>;
        participantes_capitanes: Array<{ id: string; nombre: string; apellido: string }>;
      };
    },
    enabled: publico && !!congregacionId,
  });

  if (publico) {
    const d = pubQuery.data;
    return {
      programa: ((d?.programa || []) as unknown[]) as typeof auth.programa,
      horarios: ((d?.horarios || []) as unknown[]) as typeof auth.horarios,
      puntos: ((d?.puntos || []) as unknown[]) as typeof auth.puntos,
      territorios: ((d?.territorios || []) as unknown[]) as typeof auth.territorios,
      gruposPredicacion: ((d?.grupos_predicacion || []) as unknown[]) as typeof gruposAuth,
      diasEspeciales: ((d?.dias_especiales || []) as unknown[]) as typeof diasEspecialesAuth,
      configuraciones: ((d?.configuracion_general || []) as unknown[]) as typeof configsAuth,
      participantes: ((d?.participantes_capitanes || []) as unknown[]) as typeof participantes,
      isLoading: pubQuery.isLoading,
    };
  }

  return {
    programa: auth.programa,
    horarios: auth.horarios,
    puntos: auth.puntos,
    territorios: auth.territorios,
    gruposPredicacion: gruposAuth,
    diasEspeciales: diasEspecialesAuth,
    configuraciones: configsAuth,
    participantes,
    isLoading: auth.isLoading || loadingConfigAuth,
  };
}

export function ProgramaSemanal({ publico = false, congregacionId }: ProgramaSemanalProps = {}) {
  const isMobile = useIsMobile();
  const hoy = new Date();
  const hoyStr = format(hoy, "yyyy-MM-dd");

  // Estado del 2do día (inicialmente mañana). Navegable dentro del mes en curso
  // y, en la última semana, también dentro del mes siguiente.
  const mananaDefault = useMemo(() => addDays(new Date(), 1), []);
  const [segundoDia, setSegundoDia] = useState<Date>(mananaDefault);

  const diasRestantesMesActual = differenceInCalendarDays(endOfMonth(hoy), hoy);
  const extensionHabilitada = diasRestantesMesActual < 7;

  // Mínimo: HOY (no se puede ir antes de hoy). Máximo: fin de mes actual, o fin del
  // mes siguiente si estamos en la última semana del mes en curso.
  const minDate = hoy;
  const maxDate = extensionHabilitada ? endOfMonth(addMonths(hoy, 1)) : endOfMonth(hoy);

  const canPrev = isAfter(segundoDia, minDate) && !isSameDay(segundoDia, minDate);
  const canNext = isBefore(segundoDia, maxDate) && !isSameDay(segundoDia, maxDate);

  const handlePrev = () => { if (canPrev) setSegundoDia(addDays(segundoDia, -1)); };
  const handleNext = () => { if (canNext) setSegundoDia(addDays(segundoDia, 1)); };

  // Auto-reset al "mañana" tras 10s de inactividad si el usuario navegó a otro día
  useEffect(() => {
    if (isSameDay(segundoDia, mananaDefault)) return;
    const t = setTimeout(() => setSegundoDia(mananaDefault), 10000);
    return () => clearTimeout(t);
  }, [segundoDia, mananaDefault]);

  const segundoDiaStr = format(segundoDia, "yyyy-MM-dd");
  const fechaInicio = hoyStr < segundoDiaStr ? hoyStr : segundoDiaStr;
  const fechaFin = hoyStr > segundoDiaStr ? hoyStr : segundoDiaStr;

  const {
    programa, horarios, puntos, territorios, gruposPredicacion,
    diasEspeciales, configuraciones, participantes, isLoading,
  } = useDatosPrograma(publico, congregacionId, fechaInicio, fechaFin);

  const diasReunionConfig = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
  )?.valor as DiasReunionConfig | undefined;

  // Array de 2 fechas: hoy + segundo día seleccionado
  const fechas = useMemo(() => [hoyStr, segundoDiaStr], [hoyStr, segundoDiaStr]);

  // Clasificar horarios por mañana/tarde (respeta `franja` del horario)
  const clasificarHorario = (horarioId: string): "manana" | "tarde" => {
    const horario = horarios.find(h => h.id === horarioId);
    if (!horario) return "manana";
    const franja = (horario as { franja?: string }).franja;
    if (franja === "manana" || franja === "tarde") return franja;
    const nombreLower = horario.nombre.toLowerCase();
    if (nombreLower.includes("mañana") || nombreLower.includes("manana")) return "manana";
    if (nombreLower.includes("tarde")) return "tarde";
    const hora = parseInt(horario.hora.split(":")[0], 10);
    return hora < 12 ? "manana" : "tarde";
  };

  // Obtener mensaje de reunión para una fecha
  const getMensajeReunion = (fecha: string): { mensaje: string; hora: string; zoomUrl?: string } | null => {
    if (!diasReunionConfig) return null;
    
    const date = parseISO(fecha);
    const diaSemana = format(date, "EEEE", { locale: es }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const normalizar = (dia: string) => dia?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
    
    const diaEntreSemana = normalizar(diasReunionConfig.dia_entre_semana || "");
    const diaFinSemana = normalizar(diasReunionConfig.dia_fin_semana || "");
    
    if (diaSemana === diaEntreSemana) {
      return {
        mensaje: "Reunión Vida y Ministerio Cristiano",
        hora: diasReunionConfig.hora_entre_semana || "19:30",
        zoomUrl: diasReunionConfig.zoom_entre_semana?.trim() || undefined,
      };
    }
    
    if (diaSemana === diaFinSemana) {
      return {
        mensaje: "Reunión Pública",
        hora: diasReunionConfig.hora_fin_semana || "18:00",
        zoomUrl: diasReunionConfig.zoom_fin_semana?.trim() || undefined,
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

      // Detectar si cada grupo tiene territorio individual (todos distintos)
      const territoriosPorGrupo = asignaciones.map(a => a.territorio_id).filter(Boolean);
      const territoriosUnicos = new Set(territoriosPorGrupo);
      const esSalidaIndividual = territoriosPorGrupo.length > 0 && territoriosUnicos.size === territoriosPorGrupo.length;

      if (esSalidaIndividual) {
        // FORMATO COMPACTO HORIZONTAL: cada grupo con su propio territorio
        const items = asignaciones
          .map(asig => {
            const grupo = gruposPredicacion?.find(g => g.id === asig.grupo_id);
            if (!grupo) return null;
            const terrId = asig.territorio_id || null;
            const puntoId = asig.punto_encuentro_id || null;
            return { grupoNum: grupo.numero, terrId, puntoId };
          })
          .filter(Boolean)
          .sort((a, b) => a!.grupoNum - b!.grupoNum) as { grupoNum: number; terrId: string | null; puntoId: string | null }[];

        return (
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {!isMobile && <Clock className="h-3.5 w-3.5" />}
              <span className="font-medium">{horario?.hora.slice(0, 5)}</span>
            </div>
            <div className="text-xs bg-muted/50 rounded p-2 space-y-1">
              <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0">
                {items.map((item, idx) => (
                  <span key={idx} className="whitespace-nowrap inline-flex items-center">
                    {idx > 0 && <span className="text-muted-foreground mx-1">/</span>}
                    <span className="font-semibold">G{item.grupoNum}:</span>
                    <span className="ml-1">
                      {item.terrId ? (
                        <TerritorioLink territorioIds={[item.terrId]} territorios={territorios} className="text-xs" />
                      ) : (
                        <span>-</span>
                      )}
                    </span>
                  </span>
                ))}
              </div>
              <div className="text-muted-foreground">
                Capitán: Superintendente de cada Grupo
              </div>
              {(() => {
                const puntoIds = items.map(i => i.puntoId).filter(Boolean) as string[];
                if (puntoIds.length === 0) return null;
                const unicos = Array.from(new Set(puntoIds));
                if (unicos.length === 1) {
                  const p = puntos.find(pp => pp.id === unicos[0]);
                  if (!p) return null;
                  return (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Navigation className="h-3 w-3" />
                      <span>Salida:</span>
                      {p.url_maps ? (
                        <a href={p.url_maps} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.nombre}</a>
                      ) : (
                        <span>{p.nombre}</span>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Navigation className="h-3 w-3" />Salidas:</span>
                    {items.map((it, i) => {
                      const p = it.puntoId ? puntos.find(pp => pp.id === it.puntoId) : null;
                      if (!p) return null;
                      return (
                        <span key={i} className="whitespace-nowrap">
                          <span className="font-semibold">G{it.grupoNum}:</span>{" "}
                          {p.url_maps ? (
                            <a href={p.url_maps} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.nombre}</a>
                          ) : (
                            <span>{p.nombre}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      } else {
        // FORMATO DETALLADO VERTICAL: grupos comparten territorio
        const gruposAgrupados: {
          grupoNums: number[];
          territorioId: string | null;
          capitanId: string | null;
          puntoId: string | null;
        }[] = [];

        asignaciones.forEach(asig => {
          const grupo = gruposPredicacion?.find(g => g.id === asig.grupo_id);
          if (!grupo) return;
          const key = `${asig.territorio_id || 'null'}_${asig.capitan_id || 'null'}_${asig.punto_encuentro_id || 'null'}`;
          const existing = gruposAgrupados.find(g =>
            `${g.territorioId || 'null'}_${g.capitanId || 'null'}_${g.puntoId || 'null'}` === key
          );
          if (existing) {
            existing.grupoNums.push(grupo.numero);
          } else {
            gruposAgrupados.push({
              grupoNums: [grupo.numero],
              territorioId: asig.territorio_id,
              capitanId: asig.capitan_id,
              puntoId: asig.punto_encuentro_id || null,
            });
          }
        });

        gruposAgrupados.forEach(g => g.grupoNums.sort((a, b) => a - b));

        return (
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {!isMobile && <Clock className="h-3.5 w-3.5" />}
              <span className="font-medium">{horario?.hora.slice(0, 5)}</span>
            </div>
            <div className="text-xs bg-muted/50 rounded p-2 space-y-1.5">
              {gruposAgrupados.map((agrupacion, idx) => {
                const gruposStr = agrupacion.grupoNums.map(n => `G${n}`).join(", ");
                const terrIds = agrupacion.territorioId ? [agrupacion.territorioId] : [];
                const cap = agrupacion.capitanId
                  ? participantes.find(p => p.id === agrupacion.capitanId)
                  : null;
                const puntoAg = agrupacion.puntoId ? puntos.find(p => p.id === agrupacion.puntoId) : null;

                return (
                  <div key={idx} className={idx > 0 ? "border-t border-border/50 pt-1.5" : ""}>
                    <div className="flex items-center gap-1 font-semibold">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground font-normal">Grupo:</span>
                      {gruposStr}
                    </div>
                    {terrIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Territorio:</span>
                        <TerritorioLink territorioIds={terrIds} territorios={territorios} className="text-xs" />
                      </div>
                    )}
                    {puntoAg && (
                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Salida:</span>
                        {puntoAg.url_maps ? (
                          <a href={puntoAg.url_maps} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{puntoAg.nombre}</a>
                        ) : (
                          <span>{puntoAg.nombre}</span>
                        )}
                      </div>
                    )}
                    {cap && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Capitán:</span>
                        <span>{cap.nombre} {cap.apellido}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
    }

    // Versión móvil: sin iconos, más compacto
    if (isMobile) {
      return (
        <div className="space-y-0.5">
          <div className="text-sm">
            <span className="font-medium">{horario?.hora.slice(0, 5)}</span>
          </div>
          
          {punto && (
            <div className="text-xs">
              <div className="font-medium">{punto.nombre}</div>
              {punto.direccion && !esZoom && (
                <div>
                  {punto.url_maps ? (
                    <a 
                      href={punto.url_maps} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {punto.direccion} ↗
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{punto.direccion}</span>
                  )}
                </div>
              )}
              {esZoom && punto.url_maps && (
                <a 
                  href={punto.url_maps} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Unirse ↗
                </a>
              )}
            </div>
          )}
          
          {territorioIds.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Territorio:</span>
              <TerritorioLink territorioIds={territorioIds} territorios={territorios} className="text-xs" />
            </div>
          )}
          
          {capitan && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Capitán:</span>
              <span>{capitan.nombre} {capitan.apellido}</span>
            </div>
          )}
        </div>
      );
    }

    // Versión desktop: con iconos
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{horario?.hora.slice(0, 5)}</span>
        </div>
        
        {punto && (
          <div className="flex items-start gap-2 text-sm">
            <Navigation className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
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
          <div className="flex items-center gap-1 text-xs">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Territorio:</span>
            <TerritorioLink territorioIds={territorioIds} territorios={territorios} className="text-xs" />
          </div>
        )}
        
        {capitan && (
          <div className="flex items-center gap-1 text-xs">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Capitán:</span>
            <span>{capitan.nombre} {capitan.apellido}</span>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg uppercase">
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
      <CardTitle className="flex items-center gap-2 text-lg uppercase">
        <Calendar className="h-5 w-5 text-primary" />
        Predicación
      </CardTitle>
    </CardHeader>
      <CardContent className="space-y-3">
        {fechas.map((fecha, idx) => {
          const esNavegable = idx === 1;
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

          const hayContenidoPrograma = entradasManana.length > 0 || entradasTarde.length > 0 || !!mensajeEspecial || !!reunion;
          const tieneProgramacion = hayContenidoPrograma || !!diaEspecial;

          return (
            <div 
              key={fecha} 
              className={`border rounded-lg p-3 ${esHoy ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {esNavegable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handlePrev}
                    disabled={!canPrev}
                    aria-label="Día anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
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
                {esNavegable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 ml-auto"
                    onClick={handleNext}
                    disabled={!canNext}
                    aria-label="Día siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {diaEspecial && !hayContenidoPrograma ? (
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
              ) : (() => {
                  const hayEntradasTarde = entradasTarde.length > 0;
                  // Clasificar reunión como mañana o tarde según su hora
                  const reunionEsManana = reunion ? parseInt(reunion.hora.split(":")[0], 10) < 12 : false;
                  const reunionEnManana = reunion && reunionEsManana;
                  const reunionEnTarde = reunion && !reunionEsManana;

                  // Determinar si hay contenido real en la tarde (entradas o reunión de tarde)
                  const hayContenidoTarde = hayEntradasTarde || !!reunionEnTarde;
                  
                  const renderReunionBlock = () => {
                    const esVym = reunion!.mensaje.toLowerCase().includes("vida");
                    const targetId = esVym ? "card-vym-semanal" : "card-reunion-publica-semanal";
                    const zoomUrl = reunion!.zoomUrl;
                    return (
                      <div className="text-sm pl-2 border-l-2 border-primary/30">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{reunion!.hora}</span>
                        </div>
                        <button
                          type="button"
                          className="text-primary hover:text-primary/80 transition-colors text-left"
                          onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        >
                          {reunion!.mensaje}
                        </button>
                        {zoomUrl && (
                          <a
                            href={zoomUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Unirse a la reunión por Zoom
                          </a>
                        )}
                      </div>
                    );
                  };

                  if (!hayContenidoTarde) {
                    // Solo mañana: usar todo el ancho
                    return (
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
                        {reunionEnManana && (
                          <div className="pt-2 border-t border-muted-foreground/20">
                            {renderReunionBlock()}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                      <div className="space-y-2">
                        {(entradasManana.length > 0 || reunionEnManana) && (
                          <>
                            <span className="text-xs font-medium text-muted-foreground uppercase">Mañana</span>
                            {entradasManana.map(entrada => (
                              <div key={entrada.id} className="pl-2 border-l-2 border-primary/30">
                                {renderEntrada(entrada)}
                              </div>
                            ))}
                            {reunionEnManana && (
                              <div className={entradasManana.length > 0 ? "pt-2 border-t border-muted-foreground/20" : ""}>
                                {renderReunionBlock()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className={`flex flex-col ${isMobile ? "border-t border-muted-foreground/20 pt-3" : "border-l border-muted-foreground/30 pl-4"}`}>
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase">Tarde</span>
                          {entradasTarde.map(entrada => (
                            <div key={entrada.id} className="pl-2 border-l-2 border-primary/30">
                              {renderEntrada(entrada)}
                            </div>
                          ))}
                        </div>
                        
                        {reunionEnTarde && (
                          <div className={entradasTarde.length > 0 ? "mt-3 pt-3 border-t border-muted-foreground/20" : ""}>
                            {renderReunionBlock()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
