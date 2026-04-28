import { useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Calendar, BookOpen, GraduationCap } from "lucide-react";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useAuth } from "@/hooks/useAuth";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface AsignacionItem {
  id: string;
  fecha: string;
  fechaFormateada: string;
  hora?: string;
  tipo: string;
  tipoAsignacion: "predicacion" | "reunion_publica" | "vida_ministerio";
}

export function MisAsignaciones() {
  const { user } = useAuth();
  const congregacionId = useCongregacionId();
  const hoy = new Date();
  const hoyStr = format(hoy, "yyyy-MM-dd");

  // Rango: desde hoy hasta fin del próximo mes (cubrir 2 meses)
  const mesActual = hoy;
  const mesSiguiente = addMonths(hoy, 1);
  const fechaInicio = format(startOfMonth(mesActual), "yyyy-MM-dd");
  const fechaFin = format(endOfMonth(mesSiguiente), "yyyy-MM-dd");

  // Obtener participante_id desde usuarios_congregacion (más confiable que comparar nombres)
  const { data: miParticipanteId, isLoading: loadingParticipante } = useQuery({
    queryKey: ["mi-participante-id", user?.id, congregacionId],
    queryFn: async () => {
      if (!user?.id || !congregacionId) return null;
      const { data } = await supabase
        .from("usuarios_congregacion")
        .select("participante_id")
        .eq("user_id", user.id)
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .maybeSingle();
      return data?.participante_id || null;
    },
    enabled: !!user?.id && !!congregacionId,
  });

  // Obtener nombre del participante
  const { data: miParticipante } = useQuery({
    queryKey: ["mi-participante-nombre", miParticipanteId],
    queryFn: async () => {
      if (!miParticipanteId) return null;
      const { data } = await supabase
        .from("participantes")
        .select("id, nombre, apellido")
        .eq("id", miParticipanteId)
        .single();
      return data;
    },
    enabled: !!miParticipanteId,
  });

  // Predicación: rango amplio
  const { programa: programaPredicacion, horarios, isLoading: loadingPrograma } = useProgramaPredicacion(fechaInicio, fechaFin);

  // Reunión Pública: mes actual y siguiente
  const { programa: programaReunionActual, isLoading: loadingReunionActual } = useReunionPublica(mesActual.getMonth(), mesActual.getFullYear());
  const { programa: programaReunionSiguiente, isLoading: loadingReunionSiguiente } = useReunionPublica(mesSiguiente.getMonth(), mesSiguiente.getFullYear());

  // Vida y Ministerio: todas las semanas activas
  const { data: programasVyM = [], isLoading: loadingVyM } = useProgramasVidaMinisterio();

  const isLoading = loadingParticipante || loadingPrograma || loadingReunionActual || loadingReunionSiguiente || loadingVyM;

  // Asignaciones de predicación (capitán)
  const asignacionesPredicacion: AsignacionItem[] = !miParticipanteId ? [] : programaPredicacion
    .filter(p => {
      if (p.fecha < hoyStr) return false;
      if (p.capitan_id === miParticipanteId) return true;
      if (p.asignaciones_grupos && Array.isArray(p.asignaciones_grupos)) {
        return p.asignaciones_grupos.some((asig: any) => asig.capitan_id === miParticipanteId);
      }
      return false;
    })
    .map(entrada => {
      const horario = horarios.find(h => h.id === entrada.horario_id);
      const fecha = parseISO(entrada.fecha);
      return {
        id: entrada.id,
        fecha: entrada.fecha,
        fechaFormateada: format(fecha, "EEEE d 'de' MMM", { locale: es }),
        hora: horario?.hora.slice(0, 5) || "",
        tipo: "Capitán",
        tipoAsignacion: "predicacion" as const,
      };
    });

  // Reunión Pública: combinar ambos meses y deduplicar
  const todasEntradasReunion = [
    ...(programaReunionActual || []),
    ...(programaReunionSiguiente || []),
  ];
  const entradasUnicas = Array.from(new Map(todasEntradasReunion.map(e => [e.id, e])).values());

  const asignacionesReunionPublica: AsignacionItem[] = [];
  if (miParticipanteId) {
    const rolesReunion: { campo: string; label: string }[] = [
      { campo: "presidente_id", label: "Presidente" },
      { campo: "orador_id", label: "Orador" },
      { campo: "orador_suplente_id", label: "Orador Suplente" },
      { campo: "orador_saliente_id", label: "Orador Saliente" },
      { campo: "conductor_atalaya_id", label: "Conductor Atalaya" },
      { campo: "lector_atalaya_id", label: "Lector Atalaya" },
    ];

    entradasUnicas.forEach(entrada => {
      if (entrada.fecha < hoyStr) return;
      const fecha = parseISO(entrada.fecha);
      const fechaFormateada = format(fecha, "EEEE d 'de' MMM", { locale: es });

      rolesReunion.forEach(({ campo, label }) => {
        if ((entrada as any)[campo] === miParticipanteId) {
          asignacionesReunionPublica.push({
            id: `${entrada.id}-${campo}`,
            fecha: entrada.fecha,
            fechaFormateada,
            tipo: label,
            tipoAsignacion: "reunion_publica",
          });
        }
      });
    });
  }

  const todasAsignaciones = [...asignacionesPredicacion, ...asignacionesReunionPublica]
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const tieneAsignaciones = todasAsignaciones.length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <User className="h-4 w-4" />
            Mis Asignaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <User className="h-4 w-4 text-primary" />
            Mis Asignaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground text-center">
            Inicia sesión para ver tus asignaciones
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!miParticipanteId) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <User className="h-4 w-4 text-primary" />
            Mis Asignaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground text-center">
            No se encontró un participante asociado a tu cuenta
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <User className="h-4 w-4 text-primary" />
          Mis Asignaciones
        </CardTitle>
        {miParticipante && (
          <p className="text-xs text-muted-foreground">
            {miParticipante.nombre} {miParticipante.apellido}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!tieneAsignaciones ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No tienes asignaciones próximas
          </p>
        ) : (
          <div className="space-y-3">
            {(() => {
              const porMes: Record<string, AsignacionItem[]> = {};
              todasAsignaciones.forEach(asig => {
                const mesKey = format(parseISO(asig.fecha), "yyyy-MM");
                if (!porMes[mesKey]) porMes[mesKey] = [];
                porMes[mesKey].push(asig);
              });
              return Object.entries(porMes).map(([mesKey, asignaciones]) => (
                <div key={mesKey} className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {format(parseISO(`${mesKey}-01`), "MMMM yyyy", { locale: es })}
                  </p>
                  {asignaciones.map(asig => (
                    <div
                      key={asig.id}
                      className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1"
                    >
                      {asig.tipoAsignacion === "predicacion" ? (
                        <Calendar className="h-3 w-3 text-primary flex-shrink-0" />
                      ) : (
                        <BookOpen className="h-3 w-3 text-primary flex-shrink-0" />
                      )}
                      <span className="capitalize truncate">
                        {format(parseISO(asig.fecha), "EEEE d", { locale: es })}
                      </span>
                      {asig.hora && (
                        <span className="text-primary font-medium">{asig.hora}</span>
                      )}
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium truncate">{asig.tipo}</span>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
