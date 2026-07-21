import { useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useProgramasPublicados } from "@/hooks/useProgramasPublicados";
import { useAuth } from "@/hooks/useAuth";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TIPOS_ASIGNACION_SERVICIO } from "@/hooks/useAsignacionesServicio";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";

const DIA_SEMANA_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

interface AsignacionItem {
  id: string;
  fecha: string;
  fechaFormateada: string;
  hora?: string;
  tipo: string;
  tipoAsignacion: "predicacion" | "reunion_publica" | "vida_ministerio" | "servicio";
}

export function MisAsignaciones() {
  const { user } = useAuth();
  const congregacionId = useCongregacionId();
  const hoy = new Date();
  const hoyStr = format(hoy, "yyyy-MM-dd");
  const { getConfigValue } = useConfiguracionSistema("general");
  const diaEntreSemanaVyM = (getConfigValue("dias_reunion") as { dia_entre_semana?: string } | undefined)?.dia_entre_semana ?? "martes";
  const offsetDiaVyM = (DIA_SEMANA_MAP[diaEntreSemanaVyM] ?? 2) - 1;

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
    queryKey: ["mi-participante-detalle", miParticipanteId],
    queryFn: async () => {
      if (!miParticipanteId) return null;
      const { data } = await supabase
        .from("participantes")
        .select("id, nombre, apellido, grupo_predicacion_id")
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

  // Asignaciones de Servicio: por participante o por grupo de predicación
  const { data: asignacionesServicio = [], isLoading: loadingServicio } = useQuery({
    queryKey: ["mis-asignaciones-servicio", congregacionId, miParticipanteId, miParticipante?.grupo_predicacion_id, fechaInicio, fechaFin],
    queryFn: async () => {
      if (!congregacionId || !miParticipanteId) return [];
      const filters: string[] = [`participante_id.eq.${miParticipanteId}`];
      if (miParticipante?.grupo_predicacion_id) {
        filters.push(`grupo_predicacion_id.eq.${miParticipante.grupo_predicacion_id}`);
      }
      const { data, error } = await supabase
        .from("programa_asignaciones_servicio")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
        .or(filters.join(","));
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!congregacionId && !!miParticipanteId,
  });

  // Programas publicados por tipo: una asignación solo se muestra si el mes de su
  // fecha está publicado (mientras no se re-publique tras un cambio, se sigue
  // mostrando la versión publicada más reciente).
  const { programas: publicadosPredicacion } = useProgramasPublicados("predicacion");
  const { programas: publicadosReunionPublica } = useProgramasPublicados("reunion_publica");
  const { programas: publicadosVyM } = useProgramasPublicados("vida_ministerio");
  const { programas: publicadosServicio } = useProgramasPublicados("asignaciones_servicio");

  const mesPublicado = (
    lista: { activo: boolean; fecha_inicio: string; fecha_fin: string }[],
    fechaISO: string
  ) => lista.some((p) => p.activo && fechaISO >= p.fecha_inicio && fechaISO <= p.fecha_fin);

  const isLoading = loadingParticipante || loadingPrograma || loadingReunionActual || loadingReunionSiguiente || loadingVyM || loadingServicio;


  // Asignaciones de predicación (capitán) — sin etiqueta "Capitán"
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
      const fecha = parseISO(entrada.fecha);
      return {
        id: entrada.id,
        fecha: entrada.fecha,
        fechaFormateada: format(fecha, "EEEE d 'de' MMM", { locale: es }),
        tipo: "Predicación",
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

  // Vida y Ministerio
  const asignacionesVidaMinisterio: AsignacionItem[] = [];
  if (miParticipanteId) {
    programasVyM.forEach((prog: any) => {
      if (!prog.fecha_semana) return;
      // fecha_semana es siempre el lunes; el offset lleva al día real configurado
      const fechaReunion = addDays(parseISO(prog.fecha_semana), offsetDiaVyM);
      const fechaReunionStr = format(fechaReunion, "yyyy-MM-dd");
      if (fechaReunionStr < hoyStr) return;
      const fechaFormateada = format(fechaReunion, "EEEE d 'de' MMM", { locale: es });
      const push = (key: string, tipo: string) => {
        asignacionesVidaMinisterio.push({
          id: `vym-${prog.id}-${key}`,
          fecha: fechaReunionStr,
          fechaFormateada,
          tipo,
          tipoAsignacion: "vida_ministerio",
        });
      };

      if (prog.presidente_id === miParticipanteId) push("presidente", "Presidente");
      if (prog.oracion_inicial_id === miParticipanteId) push("oracion-ini", "Oración");
      if (prog.oracion_final_id === miParticipanteId) push("oracion-fin", "Oración");
      if (prog.perlas_id === miParticipanteId) push("perlas", "Perlas");
      if (prog.tesoros?.participante_id === miParticipanteId) push("tesoros", "Tesoros");
      if (prog.lectura_biblica?.participante_id === miParticipanteId) push("lectura", "Lectura");
      if (prog.encargado_sala_b_id === miParticipanteId) push("sala-b", "Sala B");
      if (prog.encargado_sala_c_id === miParticipanteId) push("sala-c", "Sala C");
      if (prog.estudio_biblico?.conductor_id === miParticipanteId) push("eb-cond", "Estudio BC");
      if (prog.estudio_biblico?.lector_id === miParticipanteId) push("eb-lect", "Lectura EBC");

      (prog.maestros || []).forEach((m: any, idx: number) => {
        if (m.titular_id === miParticipanteId) push(`m${idx}-tit`, "Maestros");
        if (m.ayudante_id === miParticipanteId) push(`m${idx}-ay`, "Maestros");
        if (m.titular_sala_b_id === miParticipanteId) push(`m${idx}-tit-b`, "Maestros (Sala B)");
        if (m.ayudante_sala_b_id === miParticipanteId) push(`m${idx}-ay-b`, "Maestros (Sala B)");
        if (m.titular_sala_c_id === miParticipanteId) push(`m${idx}-tit-c`, "Maestros (Sala C)");
        if (m.ayudante_sala_c_id === miParticipanteId) push(`m${idx}-ay-c`, "Maestros (Sala C)");
      });

      (prog.vida_cristiana || []).forEach((v: any, idx: number) => {
        if (v.participante_id === miParticipanteId) {
          push(`vc${idx}`, v.titulo || "Vida Cristiana");
        }
      });
    });
  }

  // Asignaciones de Servicio
  const asignacionesServicioItems: AsignacionItem[] = [];
  asignacionesServicio.forEach((a: any) => {
    if (a.fecha < hoyStr) return;
    const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === a.tipo_asignacion);
    let label = cfg?.label || a.tipo_asignacion;
    const esAseo = a.tipo_asignacion?.startsWith("aseo_");
    if (esAseo) label = "Aseo Salón";
    const esGrupo = !!a.grupo_predicacion_id && a.participante_id == null;
    asignacionesServicioItems.push({
      id: `srv-${a.id}`,
      fecha: a.fecha,
      fechaFormateada: format(parseISO(a.fecha), "EEEE d 'de' MMM", { locale: es }),
      tipo: esGrupo && !esAseo ? `${label} (mi grupo)` : label,
      tipoAsignacion: "servicio",
    });
  });

  // Solo se muestran asignaciones cuyo mes ya fue publicado (por tipo de programa).
  const todasAsignaciones = [
    ...asignacionesPredicacion.filter((a) => mesPublicado(publicadosPredicacion, a.fecha)),
    ...asignacionesReunionPublica.filter((a) => mesPublicado(publicadosReunionPublica, a.fecha)),
    ...asignacionesVidaMinisterio.filter((a) => mesPublicado(publicadosVyM, a.fecha)),
    ...asignacionesServicioItems.filter((a) => mesPublicado(publicadosServicio, a.fecha)),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));


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
              // Agrupar por mes y dentro de cada mes por fecha
              const porMes: Record<string, Record<string, AsignacionItem[]>> = {};
              todasAsignaciones.forEach(asig => {
                const mesKey = format(parseISO(asig.fecha), "yyyy-MM");
                if (!porMes[mesKey]) porMes[mesKey] = {};
                if (!porMes[mesKey][asig.fecha]) porMes[mesKey][asig.fecha] = [];
                porMes[mesKey][asig.fecha].push(asig);
              });
              return Object.entries(porMes).map(([mesKey, dias]) => (
                <div key={mesKey} className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {format(parseISO(`${mesKey}-01`), "MMMM yyyy", { locale: es })}
                  </p>
                  {Object.entries(dias).map(([fecha, items]) => {
                    const fechaObj = parseISO(fecha);
                    const dia = format(fechaObj, "EEEE d", { locale: es });
                    // Deduplicar tipos
                    const tipos = Array.from(new Set(items.map(i => i.tipo)));
                    return (
                      <div
                        key={fecha}
                        className="text-xs bg-muted/50 rounded px-2 py-1 leading-snug"
                      >
                        <span className="font-semibold capitalize text-primary">{dia}</span>
                        <span className="text-muted-foreground">: </span>
                        <span>{tipos.join(" / ")}</span>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
