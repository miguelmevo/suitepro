import { useMemo, useState, useRef, useEffect, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths, subMonths, addDays, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Wand2, Sparkles, Printer, Trash2, Upload, Ban, Loader2, CalendarOff, X, BarChart3, ChevronDown, Eye } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProgramaBloqueado } from "@/hooks/useProgramaBloqueado";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useAsignacionesServicioDiasEspeciales } from "@/hooks/useAsignacionesServicioDiasEspeciales";
import { useMensajesAdicionales } from "@/hooks/useMensajesAdicionales";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { GeneracionAutomaticaOverlay } from "@/components/ui/GeneracionAutomaticaOverlay";
import { useReactToPrint } from "react-to-print";
import {
  TIPOS_ASIGNACION_SERVICIO,
  getMeetingDatesForMonth,
  useAsignacionesServicio,
  TEXTO_LIBRE_VALUE,
  esTextoLibre,
  type TipoAsignacionServicio,
  type AsignacionServicio,
} from "@/hooks/useAsignacionesServicio";
import { Input } from "@/components/ui/input";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useProgramasPublicados } from "@/hooks/useProgramasPublicados";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useAuthContext } from "@/contexts/AuthProvider";
import { usePermisos } from "@/hooks/usePermisos";
import { ImpresionAsignacionesServicioWrapper, type FormatoImpresionAsignaciones } from "@/components/asignaciones-servicio/ImpresionAsignacionesServicioWrapper";
import { MensajeAdicionalPopover } from "@/components/asignaciones-servicio/MensajeAdicionalPopover";
import { EstadisticasParticipacion } from "@/components/asignaciones-servicio/EstadisticasParticipacion";
import { CierreProgramaModal } from "@/components/programa/CierreProgramaModal";
import { getColorTheme } from "@/lib/congregation-colors";

/** Input controlado para el texto libre de aseo/hospitalidad. Mantiene estado local y
 *  confirma el cambio al perder el foco o al presionar Enter, para no guardar en cada tecla. */
function TextoLibreInput({
  value,
  onCommit,
  disabled,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  const commit = () => {
    if (local !== value) onCommit(local);
  };
  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={disabled}
      placeholder="Texto libre…"
      className="h-8 text-xs"
      autoFocus={!value}
    />
  );
}

export default function ProgramaAsignacionesServicio() {
  const queryClient = useQueryClient();
  const today = new Date();
  const defaultMonth = addMonths(today, 1);
  const [year, setYear] = useState(defaultMonth.getFullYear());
  const [month, setMonth] = useState(defaultMonth.getMonth());
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { configuraciones: cfgGeneral } = useConfiguracionSistema("general");
  const { configuraciones: cfgAsig } = useConfiguracionSistema("asignaciones");
  const { congregacionActual } = useCongregacion();

  const diasReunion = cfgGeneral?.find((c) => c.clave === "dias_reunion")?.valor as
    | { dia_entre_semana?: string; dia_fin_semana?: string }
    | undefined;
  const diaEntreSemana = diasReunion?.dia_entre_semana || "martes";
  const diaFinSemana = diasReunion?.dia_fin_semana || "domingo";

  const aseoAreasCfg = cfgAsig?.find((c) => c.clave === "aseo_areas")?.valor as { areas?: { label: string }[] } | undefined;
  const aseoAreas = Array.isArray(aseoAreasCfg?.areas) ? aseoAreasCfg!.areas!.slice(0, 5) : [];
  const aseoGruposPorReunion = aseoAreas.length > 0
    ? aseoAreas.length
    : (Number(cfgAsig?.find((c) => c.clave === "aseo_grupos_por_reunion")?.valor?.cantidad) || 2);
  const grupoInicialAseo =
    Number(cfgAsig?.find((c) => c.clave === "rotacion_grupo_inicial_aseo")?.valor?.numero) || 1;
  const grupoInicialHosp =
    Number(cfgAsig?.find((c) => c.clave === "rotacion_grupo_inicial_hospitalidad")?.valor?.numero) || 1;
  const formatoImpresionAsig = (cfgAsig?.find((c) => c.clave === "formato_impresion")?.valor?.formato as FormatoImpresionAsignaciones) || "horizontal";
  const colorTemaAsig = (cfgAsig?.find((c) => c.clave === "color_tema")?.valor?.color as string) || "blue";

  const { asignaciones, isLoading, upsert, bulkUpsert, eliminarTiposEnFecha, limpiarMes } = useAsignacionesServicio(year, month);
  const [isAutoGenerando, setIsAutoGenerando] = useState(false);
  const { publicarPrograma, eliminarPrograma, buscarProgramaPorPeriodo, cerrarPrograma, reabrirPrograma } = useProgramasPublicados("asignaciones_servicio");
  const { getRoleInCongregacion, roles } = useAuthContext();
  const { canCreate: _canCreate, canEdit: _canEdit, canDelete: _canDelete, canView: _canView } = usePermisos();
  const puedeCrear = _canCreate("asignaciones_servicio");
  const puedeEditar = _canEdit("asignaciones_servicio");
  const puedeEliminar = _canDelete("asignaciones_servicio");
  const puedeCerrarAsigServ = _canView("cierre_asignaciones_servicio");
  const { participantes: participantesAll = [] } = useParticipantes();
  const participantes = useMemo(
    () =>
      (participantesAll as any[]).filter(
        (p) => !(Array.isArray(p.responsabilidad) && p.responsabilidad.includes("super_circuito")),
      ),
    [participantesAll],
  );
  const { grupos = [] } = useGruposPredicacion();
  const { diasEspeciales: catalogoDiasEspeciales = [] } = useDiasEspeciales();
  const { diasEspecialesAsignados, setDiaEspecial, removeDiaEspecial } = useAsignacionesServicioDiasEspeciales(year, month);
  const { mensajesAdicionales, crearMensaje, actualizarMensaje, eliminarMensaje } = useMensajesAdicionales("asignaciones_servicio");
  const diaEspecialPorFecha = useMemo(() => {
    const m = new Map<string, { mensaje: string; color: string }>();
    diasEspecialesAsignados.forEach((d) => m.set(d.fecha, { mensaje: d.mensaje, color: d.color }));
    return m;
  }, [diasEspecialesAsignados]);
  const mensajePorFecha = useMemo(() => {
    const m = new Map<string, { id: string; mensaje: string; color: string; modulo: string }>();
    mensajesAdicionales.forEach((x) => m.set(x.fecha, { id: x.id, mensaje: x.mensaje, color: x.color, modulo: (x as any).modulo || "asignaciones_servicio" }));
    return m;
  }, [mensajesAdicionales]);

  const { programa: reunionPub = [] } = useReunionPublica(month, year);
  const { data: programasVyM = [] } = useProgramasVidaMinisterio();

  const fechasReunion = useMemo(
    () => getMeetingDatesForMonth(year, month, diaEntreSemana, diaFinSemana),
    [year, month, diaEntreSemana, diaFinSemana]
  );

  const asigByKey = useMemo(() => {
    const m = new Map<string, AsignacionServicio>();
    asignaciones.forEach((a) => m.set(`${a.fecha}__${a.tipo_asignacion}`, a));
    return m;
  }, [asignaciones]);

  // Asignados por fecha (cross-modulo: VyM + Reunión Pública)
  const ocupadosPorFecha = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (fecha: string, id?: string | null) => {
      if (!id) return;
      if (!m.has(fecha)) m.set(fecha, new Set());
      m.get(fecha)!.add(id);
    };
    reunionPub.forEach((r: any) => {
      ["presidente_id", "orador_id", "orador_suplente_id", "orador_saliente_id", "conductor_atalaya_id", "lector_atalaya_id"].forEach((c) => add(r.fecha, r[c]));
    });
    // Offset desde lunes (fecha_semana) hasta el día real de reunión entre semana de la congregación
    const DIAS_OFFSET: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };
    const offsetEntreSemana = DIAS_OFFSET[diaEntreSemana] ?? 1;
    programasVyM.forEach((p: any) => {
      if (!p.fecha_semana) return;
      const fechaReunion = format(addDays(parseISO(p.fecha_semana), offsetEntreSemana), "yyyy-MM-dd");
      // Nota: oracion_inicial_id y oracion_final_id NO bloquean asignaciones de servicio
      [p.presidente_id, p.perlas_id, p.encargado_sala_b_id, p.encargado_sala_c_id, p.tesoros?.participante_id, p.lectura_biblica?.participante_id, p.estudio_biblico?.conductor_id, p.estudio_biblico?.lector_id].forEach((id) => add(fechaReunion, id));
      (p.maestros || []).forEach((mm: any) => {
        [mm.titular_id, mm.ayudante_id, mm.titular_sala_b_id, mm.ayudante_sala_b_id, mm.titular_sala_c_id, mm.ayudante_sala_c_id].forEach((id: any) => add(fechaReunion, id));
      });
      (p.vida_cristiana || []).forEach((v: any) => add(fechaReunion, v.participante_id));
    });
    return m;
  }, [reunionPub, programasVyM, diaEntreSemana]);

  // Asignados internos (mismo día, otro slot individual de servicio)
  const asignadosInternosPorFecha = useMemo(() => {
    const m = new Map<string, Set<string>>();
    asignaciones.forEach((a) => {
      if (!a.participante_id) return;
      if (!m.has(a.fecha)) m.set(a.fecha, new Set());
      m.get(a.fecha)!.add(a.participante_id);
    });
    return m;
  }, [asignaciones]);

  // Slots del departamento ACOMODADORES (Auditorio + Entrada #1 + Entrada #2)
  const ACOMODADOR_TIPOS = useMemo(
    () => new Set<TipoAsignacionServicio>(["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"]),
    []
  );
  // Slots del departamento AUDIOVISUAL (audio, video, zoom, plataforma, pasillo 1 y 2)
  const AUDIOVISUAL_TIPOS = useMemo(
    () => new Set<TipoAsignacionServicio>(["audio", "video", "zoom", "plataforma", "pasillo_1", "pasillo_2"]),
    []
  );
  // Conteo mensual por participante en cualquier slot de acomodadores (regla: máx. 1 vez al mes)
  const acomodadorMesCount = useMemo(() => {
    const m = new Map<string, number>();
    asignaciones.forEach((a) => {
      if (a.participante_id && ACOMODADOR_TIPOS.has(a.tipo_asignacion)) {
        m.set(a.participante_id, (m.get(a.participante_id) || 0) + 1);
      }
    });
    return m;
  }, [asignaciones, ACOMODADOR_TIPOS]);
  // Conteo mensual por participante en cualquier slot de audiovisual (regla: máx. 2 vez al mes con aviso a partir de 1)
  const audiovisualMesCount = useMemo(() => {
    const m = new Map<string, number>();
    asignaciones.forEach((a) => {
      if (a.participante_id && AUDIOVISUAL_TIPOS.has(a.tipo_asignacion)) {
        m.set(a.participante_id, (m.get(a.participante_id) || 0) + 1);
      }
    });
    return m;
  }, [asignaciones, AUDIOVISUAL_TIPOS]);

  // Historial Audiovisual: participantes que tuvieron 2+ asignaciones en alguno de los 3 meses anteriores
  const { data: avHistoricoDobles = new Set<string>() } = useQuery({
    queryKey: ["av-historico-dobles", congregacionActual?.id, year, month],
    queryFn: async () => {
      if (!congregacionActual?.id) return new Set<string>();
      const base = new Date(year, month, 1);
      const inicio = format(startOfMonth(addMonths(base, -3)), "yyyy-MM-dd");
      const fin = format(endOfMonth(addMonths(base, -1)), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("programa_asignaciones_servicio")
        .select("fecha,participante_id,tipo_asignacion")
        .eq("congregacion_id", congregacionActual.id)
        .eq("activo", true)
        .gte("fecha", inicio)
        .lte("fecha", fin)
        .in("tipo_asignacion", ["audio", "video", "zoom", "plataforma", "pasillo_1", "pasillo_2"]);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data || []).forEach((a: any) => {
        if (!a.participante_id) return;
        const ym = String(a.fecha).slice(0, 7);
        const k = `${a.participante_id}__${ym}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      const dobles = new Set<string>();
      counts.forEach((cnt, k) => {
        if (cnt >= 2) dobles.add(k.split("__")[0]);
      });
      return dobles;
    },
    enabled: !!congregacionActual?.id,
  });


  // Mapa fecha -> fecha de la reunión anterior (para regla "no 2 reuniones seguidas")
  const prevFechaMap = useMemo(() => {
    const m = new Map<string, string>();
    for (let i = 1; i < fechasReunion.length; i++) {
      m.set(fechasReunion[i].fecha, fechasReunion[i - 1].fecha);
    }
    return m;
  }, [fechasReunion]);

  // Slots de Audiovisual NO-video (los que deben evitar a participantes con casilla "video" si hay alternativa)
  const AV_NO_VIDEO_TIPOS = useMemo(
    () => new Set<TipoAsignacionServicio>(["audio", "zoom", "plataforma", "pasillo_1", "pasillo_2"]),
    []
  );

  const optionsParticipante = (tipo: TipoAsignacionServicio, fecha: string) => {
    const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipo);
    if (!cfg || cfg.tipoCampo !== "individual") return [];
    const ocupados = ocupadosPorFecha.get(fecha) || new Set<string>();
    const internos = asignadosInternosPorFecha.get(fecha) || new Set<string>();
    const prevFecha = prevFechaMap.get(fecha);
    const asignadosPrev = prevFecha ? (asignadosInternosPorFecha.get(prevFecha) || new Set<string>()) : new Set<string>();
    const yaEnEsteSlot = asigByKey.get(`${fecha}__${tipo}`)?.participante_id || null;
    const esAcomodador = ACOMODADOR_TIPOS.has(tipo);
    const esEntrada = tipo === "acomodador_entrada_1" || tipo === "acomodador_entrada_2";

    const filtrados = participantes.filter((p: any) => {
      if (!p.activo || !p.estado_aprobado || p.es_publicador_inactivo) return false;
      if (p.genero !== "M") return false;
      if (cfg.soloAncianos && !(Array.isArray(p.responsabilidad) && p.responsabilidad.includes("anciano"))) return false;

      // Elegibilidad: TODOS los slots de acomodadores requieren el checkbox específico
      // (acomodador_auditorio, acomodador_entrada_1, acomodador_entrada_2).
      // No hay bypass para A/SM: deben tener el checkbox marcado en su ficha.
      if (cfg.respParticipante) {
        if (!(Array.isArray(p.responsabilidad) && p.responsabilidad.includes(cfg.respParticipante))) return false;
      }

      // Tope mensual: en todo el dpto. de Acomodadores, 1 sola vez por participante al mes
      if (esAcomodador && p.id !== yaEnEsteSlot) {
        if ((acomodadorMesCount.get(p.id) || 0) >= 1) return false;
      }
      // Tope mensual: en todo el dpto. de Audiovisual, máx 2 por participante al mes
      if (AUDIOVISUAL_TIPOS.has(tipo) && p.id !== yaEnEsteSlot) {
        if ((audiovisualMesCount.get(p.id) || 0) >= 2) return false;
      }


      if (ocupados.has(p.id)) return false;
      // bloquear si ya está en otro slot individual el mismo día (excepto este mismo slot)
      if (internos.has(p.id) && p.id !== yaEnEsteSlot) return false;
      // regla: no puede haber tenido asignación de servicio en la reunión inmediatamente anterior
      if (asignadosPrev.has(p.id) && p.id !== yaEnEsteSlot) return false;
      return true;
    });

    // Prioridad Video: en slots de Audiovisual distintos de "video",
    // mostrar primero a quienes NO tienen la casilla "video" (los reservamos para Video).
    if (AV_NO_VIDEO_TIPOS.has(tipo)) {
      const tieneVideo = (p: any) => Array.isArray(p.responsabilidad) && p.responsabilidad.includes("video");
      const noVideo = filtrados.filter((p: any) => !tieneVideo(p));
      const siVideo = filtrados.filter((p: any) => tieneVideo(p));
      return [...noVideo, ...siVideo];
    }

    // Entrada #1/#2: sin orden de prioridad ni patrón (se respeta el orden natural de la lista).
    return filtrados;
  };


  // Helper: ¿el participante es Anciano o Siervo Ministerial?
  const esAoSM = (id: string | null | undefined) => {
    if (!id) return false;
    const p: any = participantes.find((x: any) => x.id === id);
    const r = Array.isArray(p?.responsabilidad) ? p.responsabilidad : [];
    return r.includes("anciano") || r.includes("siervo_ministerial");
  };

  const gruposOrdenados = useMemo(() => [...grupos].sort((a, b) => a.numero - b.numero), [grupos]);

  // Calcula cursores iniciales para Aseo y Hospitalidad buscando la última reunión
  // con datos ANTES del primer día del mes actual. Si no hay historial, usa los
  // valores configurados como "Grupo inicial" (semilla).
  const calcularCursoresIniciales = async (): Promise<{ cursorAseo: number; cursorHosp: number }> => {
    const N = gruposOrdenados.length;
    const idxFromNumero = (num: number) => Math.max(0, ((num - 1) % N + N) % N);
    const idxFromGrupoId = (gid: string | null) => {
      if (!gid) return -1;
      return gruposOrdenados.findIndex((g) => g.id === gid);
    };
    const next = (c: number) => (c + 1) % N;

    let cursorAseo = idxFromNumero(grupoInicialAseo);
    let cursorHosp = idxFromNumero(grupoInicialHosp);

    if (!congregacionActual?.id || N === 0) return { cursorAseo, cursorHosp };

    const fechaInicioMes = format(startOfMonth(new Date(year, month, 1)), "yyyy-MM-dd");

    try {
      // ASEO: buscar última fecha con aseo_1/aseo_2 antes del mes actual
      const { data: aseoRows } = await supabase
        .from("programa_asignaciones_servicio")
        .select("fecha,tipo_asignacion,grupo_predicacion_id")
        .eq("congregacion_id", congregacionActual.id)
        .eq("activo", true)
        .in("tipo_asignacion", ["aseo_1", "aseo_2", "aseo_3", "aseo_4", "aseo_5"])
        .lt("fecha", fechaInicioMes)
        .not("grupo_predicacion_id", "is", null)
        .order("fecha", { ascending: false })
        .limit(25);

      if (aseoRows && aseoRows.length > 0) {
        const ultimaFecha = aseoRows[0].fecha;
        const delDia = aseoRows.filter((r: any) => r.fecha === ultimaFecha);
        // Preferir el aseo_N más alto presente para continuar la rotación
        const ordenados = [...delDia].sort((a: any, b: any) =>
          (b.tipo_asignacion || "").localeCompare(a.tipo_asignacion || "")
        );
        const ultimoIdx = idxFromGrupoId(ordenados[0]?.grupo_predicacion_id ?? null);
        if (ultimoIdx >= 0) cursorAseo = next(ultimoIdx);
      }

      // HOSPITALIDAD: buscar última fecha con hospitalidad antes del mes actual
      const { data: hospRows } = await supabase
        .from("programa_asignaciones_servicio")
        .select("fecha,grupo_predicacion_id")
        .eq("congregacion_id", congregacionActual.id)
        .eq("activo", true)
        .eq("tipo_asignacion", "hospitalidad")
        .lt("fecha", fechaInicioMes)
        .not("grupo_predicacion_id", "is", null)
        .order("fecha", { ascending: false })
        .limit(1);

      if (hospRows && hospRows.length > 0) {
        const ultimoIdx = idxFromGrupoId(hospRows[0].grupo_predicacion_id);
        if (ultimoIdx >= 0) cursorHosp = next(ultimoIdx);
      }
    } catch (e) {
      console.warn("No se pudo calcular cursores continuos, usando semilla:", e);
    }

    return { cursorAseo, cursorHosp };
  };

  const handleAutoRotar = async () => {
    if (gruposOrdenados.length === 0) {
      toast.error("No hay grupos de predicación configurados");
      return;
    }
    setIsAutoGenerando(true);
    try {
      const N = gruposOrdenados.length;
      const { cursorAseo: c0Aseo, cursorHosp: c0Hosp } = await calcularCursoresIniciales();
      let cursorAseo = c0Aseo;
      let cursorHosp = c0Hosp;

      const next = (c: number) => (c + 1) % N;

      const rows: Parameters<typeof bulkUpsert.mutateAsync>[0] = [];
      for (const dr of fechasReunion) {
        let grupoHospId: string | null = null;
        if (dr.dia_reunion === "fin_semana") {
          grupoHospId = gruposOrdenados[cursorHosp].id;
          rows.push({
            fecha: dr.fecha,
            dia_reunion: dr.dia_reunion,
            tipo_asignacion: "hospitalidad",
            grupo_predicacion_id: grupoHospId,
          });
          cursorHosp = next(cursorHosp);
        }
        const aseoTipos: TipoAsignacionServicio[] = (["aseo_1", "aseo_2", "aseo_3", "aseo_4", "aseo_5"] as TipoAsignacionServicio[]).slice(0, Math.min(aseoGruposPorReunion, 5));
        for (const tipo of aseoTipos) {
          while (grupoHospId && gruposOrdenados[cursorAseo].id === grupoHospId) {
            cursorAseo = next(cursorAseo);
          }
          const grupoAseoId = gruposOrdenados[cursorAseo].id;
          rows.push({
            fecha: dr.fecha,
            dia_reunion: dr.dia_reunion,
            tipo_asignacion: tipo,
            grupo_predicacion_id: grupoAseoId,
          });
          cursorAseo = next(cursorAseo);
        }
      }
      await bulkUpsert.mutateAsync(rows);
      await queryClient.refetchQueries({ queryKey: ["asignaciones-servicio"] });
      toast.success("Rotación de Aseo y Hospitalidad generada");
    } catch (e: any) {
      toast.error(e.message || "Error al generar la rotación");
    } finally {
      setIsAutoGenerando(false);
    }
  };

  const handleAutoGenerarTodo = async () => {
    if (fechasReunion.length === 0) {
      toast.error("No hay reuniones configuradas para este mes");
      return;
    }
    setIsAutoGenerando(true);
    try {
      const generationSeed = `${Date.now()}-${Math.random()}`;
      const hashString = (value: string) => {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
          hash ^= value.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
      };

      // Limpiar todas las asignaciones del mes antes de regenerar desde cero
      if (asignaciones.length > 0) {
        await limpiarMes.mutateAsync();
      }

      // Estado local mutable para respetar reglas durante la generación (parte desde cero)
      const localServicio = new Map<string, Set<string>>();
      const counts = new Map<string, number>();
      const acomMes = new Map<string, number>();
      const avMes = new Map<string, number>();
      const avMesPorTipo = new Map<string, Set<string>>();
      // Mapa local de asignaciones existentes: tras limpiar el mes, parte vacío
      // (no usamos `asigByKey` porque ese memo aún refleja el estado previo a la limpieza).
      const asigByKeyLocal = new Map<string, { participante_id: string | null }>();

      const rows: Parameters<typeof bulkUpsert.mutateAsync>[0] = [];
      const tiposIndividualesRaw = tiposVisibles.filter((t) => t.tipoCampo === "individual");
      const tiposIndividuales = [
        ...tiposIndividualesRaw.filter((t) => t.value === "video"),
        ...tiposIndividualesRaw.filter((t) => t.value !== "video"),
      ];

      // Helper: intenta llenar un slot. Si relajarPrev=true, ignora "no en reunión anterior".
      const intentarLlenarSlot = (
        cfg: typeof tiposIndividuales[number],
        ctx: {
          ocupadosCross: Set<string>;
          usadosHoy: Set<string>;
          asignadosPrev: Set<string>;
          entradaAoSmCubierto: boolean;
          pendientesRest: number;
          fecha: string;
        },
        relajarPrev: boolean
      ): string | null => {
        const esAcomodador = ACOMODADOR_TIPOS.has(cfg.value);
        const esAudiovisual = AUDIOVISUAL_TIPOS.has(cfg.value);
        const esEntrada = cfg.value === "acomodador_entrada_1" || cfg.value === "acomodador_entrada_2";

        const candidatos = (participantes as any[]).filter((p) => {
          if (!p.activo || !p.estado_aprobado || p.es_publicador_inactivo) return false;
          if (p.genero !== "M") return false;
          if (cfg.soloAncianos && !(Array.isArray(p.responsabilidad) && p.responsabilidad.includes("anciano"))) return false;
          const resp = Array.isArray(p.responsabilidad) ? p.responsabilidad : [];
          if (cfg.respParticipante && !resp.includes(cfg.respParticipante)) return false;
          if (esAcomodador && (acomMes.get(p.id) || 0) >= 1) return false;
          if (esAudiovisual && (avMes.get(p.id) || 0) >= 2) return false;
          if (esAudiovisual && avMesPorTipo.get(cfg.value)?.has(p.id)) return false;
          if (ctx.ocupadosCross.has(p.id)) return false;
          if (ctx.usadosHoy.has(p.id)) return false;
          if (!relajarPrev && ctx.asignadosPrev.has(p.id)) return false;
          return true;
        });

        if (candidatos.length === 0) return null;

        let pool: any[] = candidatos;
        if (esEntrada) {
          if (!ctx.entradaAoSmCubierto && ctx.pendientesRest === 1) {
            const soloAoSM = candidatos.filter((p) => esAoSM(p.id));
            if (soloAoSM.length > 0) pool = soloAoSM;
          }
        }
        if (AV_NO_VIDEO_TIPOS.has(cfg.value)) {
          const sinVideo = pool.filter((p) => !(Array.isArray(p.responsabilidad) && p.responsabilidad.includes("video")));
          if (sinVideo.length > 0) pool = sinVideo;
        }
        let saltarMinCountGlobal = false;
        if (esAudiovisual) {
          const sinAVMes = pool.filter((p) => (avMes.get(p.id) || 0) === 0);
          if (sinAVMes.length > 0) {
            pool = sinAVMes;
            saltarMinCountGlobal = true;
          } else {
            const sinHistDoble = pool.filter((p) => !avHistoricoDobles.has(p.id));
            if (sinHistDoble.length > 0) pool = sinHistDoble;
          }
        }

        if (!saltarMinCountGlobal) {
          const minCount = Math.min(...pool.map((p) => counts.get(p.id) || 0));
          pool = pool.filter((p) => (counts.get(p.id) || 0) === minCount);
        }

        // Regeneración real: respeta balance por conteo, pero rota los empates con una semilla nueva.
        // Así, al regenerar desde cero no vuelve a colocar siempre a los mismos en los mismos slots.
        const slotSeed = `${generationSeed}__${ctx.fecha}__${cfg.value}`;
        pool.sort((a: any, b: any) => {
          const ca = counts.get(a.id) || 0;
          const cb = counts.get(b.id) || 0;
          if (ca !== cb) return ca - cb;
          const ha = hashString(`${slotSeed}__${a.id}`);
          const hb = hashString(`${slotSeed}__${b.id}`);
          if (ha !== hb) return ha - hb;
          const ap = `${a.apellido || ""} ${a.nombre || ""}`.toLowerCase();
          const bp = `${b.apellido || ""} ${b.nombre || ""}`.toLowerCase();
          if (ap !== bp) return ap < bp ? -1 : 1;
          return (a.id as string).localeCompare(b.id);
        });

        return pool[0]?.id || null;
      };

      const slotsVacios: { dr: typeof fechasReunion[number]; cfg: typeof tiposIndividuales[number] }[] = [];

      for (const dr of fechasReunion) {
        const ocupadosCross = ocupadosPorFecha.get(dr.fecha) || new Set<string>();
        const prevFecha = prevFechaMap.get(dr.fecha);
        const asignadosPrev = prevFecha ? (localServicio.get(prevFecha) || new Set<string>()) : new Set<string>();
        if (!localServicio.has(dr.fecha)) localServicio.set(dr.fecha, new Set());
        const usadosHoy = localServicio.get(dr.fecha)!;

        const entradaPrevId1 = asigByKeyLocal.get(`${dr.fecha}__acomodador_entrada_1`)?.participante_id || null;
        const entradaPrevId2 = asigByKeyLocal.get(`${dr.fecha}__acomodador_entrada_2`)?.participante_id || null;
        let entradaAoSmCubierto = esAoSM(entradaPrevId1) || esAoSM(entradaPrevId2);
        const entradaPendientes = (["acomodador_entrada_1","acomodador_entrada_2"] as TipoAsignacionServicio[])
          .filter((t) => !asigByKeyLocal.get(`${dr.fecha}__${t}`)?.participante_id);
        let pendientesRest = entradaPendientes.length;

        for (const cfg of tiposIndividuales) {
          const key = `${dr.fecha}__${cfg.value}`;
          const existing = asigByKeyLocal.get(key);
          if (existing?.participante_id) continue;

          const esAcomodador = ACOMODADOR_TIPOS.has(cfg.value);
          const esAudiovisual = AUDIOVISUAL_TIPOS.has(cfg.value);
          const esEntrada = cfg.value === "acomodador_entrada_1" || cfg.value === "acomodador_entrada_2";

          const elegidoId = intentarLlenarSlot(
            cfg,
            { ocupadosCross, usadosHoy, asignadosPrev, entradaAoSmCubierto, pendientesRest, fecha: dr.fecha },
            false
          );

          if (!elegidoId) {
            slotsVacios.push({ dr, cfg });
            if (esEntrada) pendientesRest--;
            continue;
          }

          usadosHoy.add(elegidoId);
          counts.set(elegidoId, (counts.get(elegidoId) || 0) + 1);
          if (esAcomodador) acomMes.set(elegidoId, (acomMes.get(elegidoId) || 0) + 1);
          if (esAudiovisual) {
            avMes.set(elegidoId, (avMes.get(elegidoId) || 0) + 1);
            if (!avMesPorTipo.has(cfg.value)) avMesPorTipo.set(cfg.value, new Set());
            avMesPorTipo.get(cfg.value)!.add(elegidoId);
          }
          if (esEntrada) {
            pendientesRest--;
            if (esAoSM(elegidoId)) entradaAoSmCubierto = true;
          }

          rows.push({
            fecha: dr.fecha,
            dia_reunion: dr.dia_reunion,
            tipo_asignacion: cfg.value,
            participante_id: elegidoId,
          });
        }
      }

      // Pasada de relajación: rellenar vacíos ignorando "no en reunión anterior"
      for (const { dr, cfg } of slotsVacios) {
        const ocupadosCross = ocupadosPorFecha.get(dr.fecha) || new Set<string>();
        const usadosHoy = localServicio.get(dr.fecha) || new Set<string>();
        const elegidoId = intentarLlenarSlot(
          cfg,
          { ocupadosCross, usadosHoy, asignadosPrev: new Set(), entradaAoSmCubierto: true, pendientesRest: 0, fecha: dr.fecha },
          true
        );
        if (!elegidoId) continue;
        usadosHoy.add(elegidoId);
        counts.set(elegidoId, (counts.get(elegidoId) || 0) + 1);
        if (ACOMODADOR_TIPOS.has(cfg.value)) acomMes.set(elegidoId, (acomMes.get(elegidoId) || 0) + 1);
        if (AUDIOVISUAL_TIPOS.has(cfg.value)) {
          avMes.set(elegidoId, (avMes.get(elegidoId) || 0) + 1);
          if (!avMesPorTipo.has(cfg.value)) avMesPorTipo.set(cfg.value, new Set());
          avMesPorTipo.get(cfg.value)!.add(elegidoId);
        }
        rows.push({
          fecha: dr.fecha,
          dia_reunion: dr.dia_reunion,
          tipo_asignacion: cfg.value,
          participante_id: elegidoId,
        });
      }

      // Rotación de Aseo + Hospitalidad
      if (gruposOrdenados.length > 0) {
        const N = gruposOrdenados.length;
        const { cursorAseo: c0Aseo, cursorHosp: c0Hosp } = await calcularCursoresIniciales();
        let cursorAseo = c0Aseo;
        let cursorHosp = c0Hosp;
        const next = (c: number) => (c + 1) % N;

        for (const dr of fechasReunion) {
          let grupoHospId: string | null = null;
          if (dr.dia_reunion === "fin_semana") {
            grupoHospId = gruposOrdenados[cursorHosp].id;
            rows.push({ fecha: dr.fecha, dia_reunion: dr.dia_reunion, tipo_asignacion: "hospitalidad", grupo_predicacion_id: grupoHospId });
            cursorHosp = next(cursorHosp);
          }
          const aseoTipos: TipoAsignacionServicio[] = (["aseo_1", "aseo_2", "aseo_3", "aseo_4", "aseo_5"] as TipoAsignacionServicio[]).slice(0, Math.min(aseoGruposPorReunion, 5));
          for (const tipo of aseoTipos) {
            while (grupoHospId && gruposOrdenados[cursorAseo].id === grupoHospId) cursorAseo = next(cursorAseo);
            rows.push({ fecha: dr.fecha, dia_reunion: dr.dia_reunion, tipo_asignacion: tipo, grupo_predicacion_id: gruposOrdenados[cursorAseo].id });
            cursorAseo = next(cursorAseo);
          }
        }
      }

      await bulkUpsert.mutateAsync(rows);
      await queryClient.refetchQueries({ queryKey: ["asignaciones-servicio"] });
      toast.success("Programa generado automáticamente");
    } catch (e: any) {
      toast.error(e.message || "Error al generar el programa");
    } finally {
      setIsAutoGenerando(false);
    }
  };

  // Tipos visibles dependientes de aseo_grupos_por_reunion
  const tiposVisibles = useMemo(() => {
    return TIPOS_ASIGNACION_SERVICIO.filter((t) => {
      if (t.value.startsWith("aseo_")) {
        const n = Number(t.value.replace("aseo_", ""));
        return n <= Math.min(aseoGruposPorReunion, 5);
      }
      return true;
    }).map((t) => {
      // Sobrescribir el label de los aseo_N con el nombre del área configurado
      if (t.value.startsWith("aseo_")) {
        const idx = Number(t.value.replace("aseo_", "")) - 1;
        const area = aseoAreas[idx];
        if (area?.label) return { ...t, label: area.label };
      }
      return t;
    });
  }, [aseoGruposPorReunion, aseoAreas]);

  // Tipos de aseo activos según la cantidad de áreas configuradas (aseo_1..aseo_N)
  const aseoTiposActivos = useMemo(
    () =>
      (["aseo_1", "aseo_2", "aseo_3", "aseo_4", "aseo_5"] as TipoAsignacionServicio[]).slice(
        0,
        Math.min(aseoGruposPorReunion, 5)
      ),
    [aseoGruposPorReunion]
  );

  const renderCelda = (fecha: string, dr: "entre_semana" | "fin_semana", tipo: TipoAsignacionServicio) => {
    const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipo)!;
    if (cfg.soloFinSemana && dr !== "fin_semana") {
      return <div className="text-xs text-muted-foreground/40 italic">—</div>;
    }
    const key = `${fecha}__${tipo}`;
    const existing = asigByKey.get(key);

    if (cfg.tipoCampo === "individual") {
      const opts = optionsParticipante(tipo, fecha);
      const asignadoId = existing?.participante_id || null;
      const asignadoEnLista = asignadoId ? opts.some((p: any) => p.id === asignadoId) : true;
      const snapshotNombre = asignadoId && !asignadoEnLista
        ? ((existing as any)?.nombres_snapshot?.[asignadoId] || null)
        : null;
      return (
        <Select
          value={existing?.participante_id || "none"}
          onValueChange={(v) => {
            // Validación: en Entrada #1/#2, al menos uno debe ser A o SM en cada reunión.
            if (
              v !== "none" &&
              (tipo === "acomodador_entrada_1" || tipo === "acomodador_entrada_2")
            ) {
              const otroTipo: TipoAsignacionServicio =
                tipo === "acomodador_entrada_1" ? "acomodador_entrada_2" : "acomodador_entrada_1";
              const otroId = asigByKey.get(`${fecha}__${otroTipo}`)?.participante_id || null;
              if (!esAoSM(v) && otroId && !esAoSM(otroId)) {
                toast.error(
                  "Debe haber al menos un Anciano o S. Ministerial entre Entrada #1 y Entrada #2"
                );
                return;
              }
            }
            upsert.mutate({
              fecha,
              dia_reunion: dr,
              tipo_asignacion: tipo,
              participante_id: v === "none" ? null : v,
            });
          }}
        >
          <SelectTrigger className="h-8 text-xs" disabled={esReadOnly}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sin asignar —</SelectItem>
            {asignadoId && !asignadoEnLista && (
              <SelectItem value={asignadoId}>
                <span className="italic text-muted-foreground">
                  {snapshotNombre || "(participante no disponible)"}
                </span>
              </SelectItem>
            )}
            {opts.map((p: any) => {
              const esAV = AUDIOVISUAL_TIPOS.has(tipo);
              const cntMes = esAV ? (audiovisualMesCount.get(p.id) || 0) : 0;
              const tieneUnoEsteMes = esAV && cntMes >= 1 && p.id !== existing?.participante_id;
              const histDoble = esAV && avHistoricoDobles.has(p.id) && tieneUnoEsteMes;
              const totalMes = asignaciones.reduce((acc, a) => acc + (a.participante_id === p.id ? 1 : 0), 0);
              return (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-1">
                    <span>{p.nombre} {p.apellido}</span>
                    {totalMes > 0 && (
                      <span className="text-xs text-muted-foreground" title={`${totalMes} asignación(es) este mes`}>
                        ({totalMes})
                      </span>
                    )}
                    {tieneUnoEsteMes && (
                      <span title="Ya tiene 1 asignación de audiovisual este mes" className="text-xs">⚠️</span>
                    )}
                    {histDoble && (
                      <span title="Tuvo 2 asignaciones en algún mes reciente" className="text-xs">🔁</span>
                    )}
                  </span>
                </SelectItem>
              );
            })}



          </SelectContent>
        </Select>
      );
    }
    // --- Rama GRUPO: aseo (varias áreas) y hospitalidad, con soporte de texto libre ---
    const esAseo = tipo.startsWith("aseo_");

    // Select de grupos reutilizable, con la opción "Texto libre" al final
    const grupoSelect = (
      valorActual: string,
      onChange: (v: string) => void
    ) => (
      <Select value={valorActual} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs" disabled={esReadOnly}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Sin asignar —</SelectItem>
          {gruposOrdenados.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              Grupo {g.numero}
            </SelectItem>
          ))}
          <SelectItem value={TEXTO_LIBRE_VALUE}>✏️ Texto libre</SelectItem>
        </SelectContent>
      </Select>
    );

    if (esAseo) {
      // El estado de texto libre del aseo vive en la fila aseo_1
      const aseo1 = asigByKey.get(`${fecha}__aseo_1`);
      const textoLibreActivo = esTextoLibre(aseo1);

      if (tipo === "aseo_1") {
        // Dropdown 1: siempre visible. Al elegir "Texto libre" se borran las demás áreas.
        const select = grupoSelect(
          textoLibreActivo ? TEXTO_LIBRE_VALUE : existing?.grupo_predicacion_id || "none",
          (v) => {
            if (v === TEXTO_LIBRE_VALUE) {
              const otrasAreas = aseoTiposActivos.filter((t) => t !== "aseo_1");
              upsert.mutate({
                fecha,
                dia_reunion: dr,
                tipo_asignacion: "aseo_1",
                grupo_predicacion_id: null,
                notas: "",
              });
              if (otrasAreas.length) eliminarTiposEnFecha.mutate({ fecha, tipos: otrasAreas });
            } else {
              upsert.mutate({
                fecha,
                dia_reunion: dr,
                tipo_asignacion: "aseo_1",
                grupo_predicacion_id: v === "none" ? null : v,
                notas: null,
              });
            }
          }
        );
        // Caso borde: si solo hay 1 área de aseo, el input va debajo del dropdown 1
        // (no existe aseo_2 donde ubicarlo).
        if (textoLibreActivo && aseoTiposActivos.length === 1) {
          return (
            <div className="space-y-1">
              {select}
              <TextoLibreInput
                value={aseo1?.notas ?? ""}
                disabled={esReadOnly}
                onCommit={(txt) =>
                  upsert.mutate({
                    fecha,
                    dia_reunion: dr,
                    tipo_asignacion: "aseo_1",
                    grupo_predicacion_id: null,
                    notas: txt,
                  })
                }
              />
            </div>
          );
        }
        return select;
      }

      // Áreas 2..N
      if (textoLibreActivo) {
        // La segunda área muestra el input de texto libre (guarda en aseo_1.notas);
        // las demás quedan vacías.
        if (tipo === "aseo_2") {
          return (
            <TextoLibreInput
              value={aseo1?.notas ?? ""}
              disabled={esReadOnly}
              onCommit={(txt) =>
                upsert.mutate({
                  fecha,
                  dia_reunion: dr,
                  tipo_asignacion: "aseo_1",
                  grupo_predicacion_id: null,
                  notas: txt,
                })
              }
            />
          );
        }
        return <div className="text-xs text-muted-foreground/40 italic text-center">—</div>;
      }

      // Modo normal: dropdown de grupo para esta área
      return grupoSelect(existing?.grupo_predicacion_id || "none", (v) =>
        upsert.mutate({
          fecha,
          dia_reunion: dr,
          tipo_asignacion: tipo,
          grupo_predicacion_id: v === "none" ? null : v,
          notas: null,
        })
      );
    }

    // --- Hospitalidad ---
    if (esTextoLibre(existing)) {
      return (
        <div className="flex items-center gap-1">
          <TextoLibreInput
            value={existing?.notas ?? ""}
            disabled={esReadOnly}
            onCommit={(txt) =>
              upsert.mutate({
                fecha,
                dia_reunion: dr,
                tipo_asignacion: tipo,
                grupo_predicacion_id: null,
                notas: txt,
              })
            }
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={esReadOnly}
            title="Volver a selección de grupo"
            onClick={() =>
              upsert.mutate({
                fecha,
                dia_reunion: dr,
                tipo_asignacion: tipo,
                grupo_predicacion_id: null,
                notas: null,
              })
            }
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    return grupoSelect(existing?.grupo_predicacion_id || "none", (v) => {
      if (v === TEXTO_LIBRE_VALUE) {
        upsert.mutate({
          fecha,
          dia_reunion: dr,
          tipo_asignacion: tipo,
          grupo_predicacion_id: null,
          notas: "",
        });
      } else {
        upsert.mutate({
          fecha,
          dia_reunion: dr,
          tipo_asignacion: tipo,
          grupo_predicacion_id: v === "none" ? null : v,
          notas: null,
        });
      }
    });
  };

  // Print
  const printRef = useRef<HTMLDivElement>(null);
  const mesAnio = format(new Date(year, month, 1), "MMMM yyyy", { locale: es });
  const fechaInicioMes = format(new Date(year, month, 1), "yyyy-MM-dd");
  const fechaFinMes = format(new Date(year, month + 1, 0), "yyyy-MM-dd");
  const programaPublicadoExistente = buscarProgramaPorPeriodo("asignaciones_servicio", fechaInicioMes, fechaFinMes);
  const estaCerrado = programaPublicadoExistente?.cerrado ?? false;
  const isSuperAdmin = roles.includes("super_admin");
  const rolEnCong = congregacionActual?.id ? getRoleInCongregacion(congregacionActual.id) : null;
  // Quién puede abrir/cerrar el candado manualmente
  const puedeCerrarAbrir = isSuperAdmin || rolEnCong === "admin" || puedeCerrarAsigServ;
  const { bloqueado: bloqueadoPorFecha, mensaje: mensajeBloqueoPorFecha } = useProgramaBloqueado(new Date(year, month, 1), "asignaciones", isSuperAdmin, cfgAsig);
  // Cuando el programa está cerrado manualmente nadie puede editar — ni admin ni super_admin
  // deben abrir primero usando el candado (que sí pueden ver si tienen puedeCerrarAbrir)
  const esReadOnly = estaCerrado || (bloqueadoPorFecha && !isSuperAdmin);

  // Si alguna asignación, día especial o mensaje adicional del mes se modificó
  // después de la última publicación, hay cambios sin publicar y el botón
  // "Publicar" debe reaparecer (mensajes_adicionales no tiene updated_at, se usa
  // created_at como aproximación ya que no cambia de fecha al editarse).
  const hayCambiosSinPublicar = useMemo(() => {
    if (!programaPublicadoExistente) return false;
    const fechaPublicacion = new Date(programaPublicadoExistente.updated_at).getTime();
    const masReciente = (fecha?: string | null) =>
      !!fecha && new Date(fecha).getTime() > fechaPublicacion;
    return (
      asignaciones.some((a) => masReciente((a as any).updated_at)) ||
      diasEspecialesAsignados.some((d) => masReciente((d as any).updated_at)) ||
      mensajesAdicionales.some((m) => masReciente((m as any).created_at))
    );
  }, [programaPublicadoExistente, asignaciones, diasEspecialesAsignados, mensajesAdicionales]);

  const mostrarPublicar = !programaPublicadoExistente || hayCambiosSinPublicar;
  const mostrarDespublicar = !!programaPublicadoExistente;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Asignaciones de Servicio - ${mesAnio}`,
  });

  const handlePublicar = async () => {
    if (!printRef.current || fechasReunion.length === 0) return;

    setIsPublishing(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = 279.4;
      const pageHeight = 215.9;
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.98),
        "JPEG",
        margin,
        margin,
        contentWidth,
        Math.min(imgHeight, contentHeight)
      );

      const pdfBlob = pdf.output("blob");

      await publicarPrograma.mutateAsync({
        tipoProgramaId: "asignaciones_servicio",
        periodo: mesAnio.toLowerCase(),
        fechaInicio: fechaInicioMes,
        fechaFin: fechaFinMes,
        pdfBlob,
      });
    } catch (error) {
      console.error("Error publicando programa:", error);
      toast.error("Error al publicar el programa");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <GeneracionAutomaticaOverlay open={isAutoGenerando} />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-primary">
            Asignaciones de Servicio
          </h1>
          <p className="text-sm text-muted-foreground">Programa mensual de asignaciones del salón</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {!estaCerrado && puedeEditar && (
            <>
              <Button onClick={handleAutoRotar} variant="outline" size="sm" className="h-8 px-2 text-xs bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-600" title="Auto-rotar Aseo + Hospitalidad">
                <Wand2 className="h-3.5 w-3.5 mr-1" />
                A/H
              </Button>
              {asignaciones.some((a) => a.participante_id || a.grupo_predicacion_id) ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary" title="Auto-generar todo el programa">
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      Auto
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Regenerar el programa desde cero?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Este mes ya tiene asignaciones. La generación automática <strong>sobrescribirá</strong> las
                        asignaciones individuales del mes y <strong>no se puede deshacer</strong>. Cualquier ajuste
                        manual que hayas hecho se perderá.
                        <br /><br />
                        ¿Deseas continuar?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAutoGenerarTodo}>Sí, regenerar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={handleAutoGenerarTodo} variant="outline" size="sm" className="h-8 px-2 text-xs bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary" title="Auto-generar todo el programa">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Auto
                </Button>
              )}
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => setPreviewOpen(true)} size="icon" variant="outline" className="h-8 w-8 bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-600" aria-label="Vista previa">
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vista previa</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => handlePrint()} size="icon" variant="outline" className="h-8 w-8 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-600" aria-label="Generar PDF">
                <Printer className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>PDF</TooltipContent>
          </Tooltip>
          {!esReadOnly && puedeCrear && mostrarPublicar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handlePublicar}
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-600"
                  aria-label={hayCambiosSinPublicar ? "Publicar cambios" : "Publicar programa"}
                  disabled={isPublishing || publicarPrograma.isPending || fechasReunion.length === 0}
                >
                  {isPublishing || publicarPrograma.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{hayCambiosSinPublicar ? "Publicar cambios" : "Publicar"}</TooltipContent>
            </Tooltip>
          )}
          {!esReadOnly && puedeCrear && mostrarDespublicar && (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-600"
                      aria-label="Despublicar programa"
                      disabled={eliminarPrograma.isPending}
                    >
                      {eliminarPrograma.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Ban className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Despublicar</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Despublicar programa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará el PDF publicado de Asignaciones de Servicio de{" "}
                    <span className="font-semibold capitalize">{mesAnio}</span> y dejará de estar
                    disponible para todos los usuarios. Podrás volver a publicarlo cuando quieras.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      if (programaPublicadoExistente) eliminarPrograma.mutate(programaPublicadoExistente);
                    }}
                  >
                    Despublicar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {puedeCerrarAsigServ && (
            <CierreProgramaModal
              programaPublicado={programaPublicadoExistente}
              onCerrar={() => programaPublicadoExistente && cerrarPrograma.mutate(programaPublicadoExistente.id)}
              onReabrir={() => programaPublicadoExistente && reabrirPrograma.mutate(programaPublicadoExistente.id)}
              isPendingCerrar={cerrarPrograma.isPending}
              isPendingReabrir={reabrirPrograma.isPending}
              onPublicarPrimero={() => toast.error("Primero publica el programa para poder cerrarlo")}
              canReopen={puedeCerrarAbrir}
            />
          )}
          {!estaCerrado && puedeEliminar && (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="outline" className="h-8 w-8 bg-destructive/10 border-destructive/30 hover:bg-destructive/20 text-destructive" aria-label="Limpiar programa del mes">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Limpiar</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Limpiar todo el programa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán todas las asignaciones de servicio de <span className="font-semibold capitalize">{mesAnio}</span>. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      try {
                        await limpiarMes.mutateAsync();
                        toast.success("Programa limpiado");
                      } catch (e: any) {
                        toast.error(e.message || "Error al limpiar");
                      }
                    }}
                  >
                    Limpiar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {fechasReunion.length} reuniones en el mes
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-7 w-7 bg-muted/60 border-muted hover:bg-muted text-foreground" onClick={() => {
                const d = subMonths(new Date(year, month, 1), 1);
                setYear(d.getFullYear()); setMonth(d.getMonth());
              }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="capitalize text-sm font-medium min-w-[110px] text-center">{mesAnio}</span>
              <Button variant="outline" size="icon" className="h-7 w-7 bg-muted/60 border-muted hover:bg-muted text-foreground" onClick={() => {
                const d = addMonths(new Date(year, month, 1), 1);
                setYear(d.getFullYear()); setMonth(d.getMonth());
              }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
          ) : fechasReunion.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No hay reuniones configuradas para este mes</div>
          ) : (
            (() => {
              const audiovisualVals: TipoAsignacionServicio[] = ["audio","video","zoom","plataforma","pasillo_1","pasillo_2"];
              const acomodadoresVals: TipoAsignacionServicio[] = ["acomodador_auditorio","acomodador_entrada_1","acomodador_entrada_2"];
              // Solid backgrounds (gradient layered over --card) so sticky column is opaque
              const solidBg = (color: string, alpha: number) =>
                `linear-gradient(hsl(var(--${color}) / ${alpha}), hsl(var(--${color}) / ${alpha})), hsl(var(--card))`;
              const grupos = [
                { label: "Audiovisual", rowBg: solidBg("primary", 0.05), labelBg: solidBg("primary", 0.15), bannerBg: solidBg("primary", 0.25), tipos: tiposVisibles.filter(t => audiovisualVals.includes(t.value)) },
                { label: "Acomodadores", rowBg: solidBg("accent", 0.05), labelBg: solidBg("accent", 0.15), bannerBg: solidBg("accent", 0.25), tipos: tiposVisibles.filter(t => acomodadoresVals.includes(t.value)) },
                { label: "Aseo / Hospitalidad", rowBg: solidBg("warning", 0.10), labelBg: solidBg("warning", 0.20), bannerBg: solidBg("warning", 0.30), tipos: tiposVisibles.filter(t => t.value.startsWith("aseo_") || t.value === "hospitalidad") },
              ];
              const firstNonEmptyIdx = grupos.findIndex((g) => g.tipos.length > 0);
              let rowSpanCount = 0;
              grupos.forEach((g, gIdx) => {
                if (firstNonEmptyIdx < 0) return;
                if (gIdx < firstNonEmptyIdx) return;
                if (gIdx === firstNonEmptyIdx) {
                  rowSpanCount += g.tipos.length;
                } else {
                  if (gIdx > 0) rowSpanCount += 1; // spacer
                  if (g.tipos.length > 0) rowSpanCount += 1; // banner
                  rowSpanCount += g.tipos.length;
                }
              });
              return (
            <div className="relative max-h-[70vh] w-full overflow-x-auto overflow-y-auto">
            <table className="min-w-max text-xs border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="text-center p-2 sticky left-0 top-0 z-[3] min-w-[120px] font-bold uppercase text-[11px]" style={{ background: "hsl(var(--muted))" }}>Asignación</th>
                  {fechasReunion.map((dr) => {
                    const esp = diaEspecialPorFecha.get(dr.fecha);
                    const msg = mensajePorFecha.get(dr.fecha);
                    return (
                      <th key={dr.fecha} className="text-center p-2 min-w-[140px] font-bold uppercase sticky top-0 z-[2] text-[11px]" style={{ background: "hsl(var(--muted))" }}>
                        {msg && (
                          <div
                            className="mb-1 px-1 py-0.5 rounded text-[9px] font-bold uppercase truncate"
                            style={{ background: msg.color, color: "#fff" }}
                            title={msg.mensaje}
                          >
                            {msg.mensaje}
                          </div>
                        )}
                        <div className="flex items-center justify-center gap-1">
                          <span>{format(parseISO(dr.fecha), "EEEE d", { locale: es })}</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 p-0"
                                title={esp ? `Día especial: ${esp.mensaje}` : "Marcar como día especial"}
                              >
                                <CalendarOff className={`h-3 w-3 ${esp ? "" : "opacity-50"}`} style={esp ? { color: esp.color } : undefined} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2" align="end">
                              <div className="text-xs font-semibold mb-2 px-1">Día especial</div>
                              {catalogoDiasEspeciales.length === 0 && (
                                <div className="text-xs text-muted-foreground px-1 py-2">
                                  Configura mensajes en Configuración → Ajustes → Días Especiales.
                                </div>
                              )}
                              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                                {catalogoDiasEspeciales.map((d: any) => (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() =>
                                      setDiaEspecial.mutate({
                                        fecha: dr.fecha,
                                        mensaje: d.nombre,
                                        color: d.color || "#1e3a5f",
                                      })
                                    }
                                    className="text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 normal-case"
                                  >
                                    <span className="inline-block h-3 w-3 rounded" style={{ background: d.color || "#1e3a5f" }} />
                                    <span className="truncate">{d.nombre}</span>
                                  </button>
                                ))}
                              </div>
                              {esp && (
                                <button
                                  type="button"
                                  onClick={() => removeDiaEspecial.mutate(dr.fecha)}
                                  className="mt-2 w-full text-xs px-2 py-1.5 rounded hover:bg-destructive/10 text-destructive flex items-center gap-2 normal-case"
                                >
                                  <X className="h-3 w-3" /> Quitar día especial
                                </button>
                              )}
                            </PopoverContent>
                          </Popover>
                          <MensajeAdicionalPopover
                            fecha={dr.fecha}
                            existing={msg ? { id: msg.id, mensaje: msg.mensaje, color: msg.color, modulo: msg.modulo } : undefined}
                            defaultColor={getColorTheme(colorTemaAsig).pdf.headerLight}
                            onCreate={(d) => crearMensaje.mutate(d)}
                            onUpdate={(d) => actualizarMensaje.mutate(d)}
                            onDelete={(id) => eliminarMensaje.mutate(id)}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grupos.map((g, gIdx) => (
                  <Fragment key={`grp-${g.label}`}>
                    {gIdx > 0 && (
                      <tr aria-hidden>
                        <td colSpan={fechasReunion.length + 1} className="h-3"></td>
                      </tr>
                    )}
                    {g.tipos.length > 0 && (
                      <tr>
                        <td
                          className="p-1.5 sticky left-0 z-[1] font-bold uppercase text-[11px]"
                          style={{ background: g.bannerBg }}
                        >
                          {g.label}
                        </td>
                        <td colSpan={fechasReunion.length} style={{ background: g.bannerBg }}></td>
                      </tr>
                    )}
                    {g.tipos.map((t, tIdx) => (
                      <tr key={t.value}>
                        <td
                          className="p-2 sticky left-0 min-w-[120px] z-[1] font-bold text-[11px] uppercase"
                          style={{ background: g.labelBg }}
                        >
                          {t.label}
                        </td>
                        {fechasReunion.map((dr) => {
                          const esp = diaEspecialPorFecha.get(dr.fecha);
                          if (esp) {
                            // Render single rowSpan cell only on first tipo row of first non-empty group
                            if (gIdx === firstNonEmptyIdx && tIdx === 0) {
                              return (
                                <td
                                  key={dr.fecha}
                                  rowSpan={rowSpanCount}
                                  className="p-3 align-middle text-center font-bold uppercase text-xs"
                                  style={{ background: esp.color, color: "#fff" }}
                                >
                                  {esp.mensaje}
                                </td>
                              );
                            }
                            return null;
                          }
                          return (
                            <td
                              key={dr.fecha}
                              className="p-1.5 align-middle"
                              style={{ background: g.rowBg }}
                            >
                              {renderCelda(dr.fecha, dr.dia_reunion, t.value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      <EstadisticasParticipacion
        asignaciones={asignaciones}
        participantes={participantes as any}
      />

      {/* Componente oculto para impresión */}
      <div style={{ position: "absolute", left: "-99999px", top: 0 }}>
        <ImpresionAsignacionesServicioWrapper
          ref={printRef}
          formato={formatoImpresionAsig}
          fechasReunion={fechasReunion}
          tipos={tiposVisibles}
          asignaciones={asignaciones}
          participantes={participantes as any}
          grupos={gruposOrdenados as any}
          congregacionNombre={congregacionActual?.nombre || ""}
          mesAnio={mesAnio}
          colorTema={colorTemaAsig}
          diasEspeciales={diasEspecialesAsignados}
          mensajesAdicionales={mensajesAdicionales}
        />
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">Vista previa - Asignaciones de Servicio - {mesAnio}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            <ImpresionAsignacionesServicioWrapper
              formato={formatoImpresionAsig}
              fechasReunion={fechasReunion}
              tipos={tiposVisibles}
              asignaciones={asignaciones}
              participantes={participantes as any}
              grupos={gruposOrdenados as any}
              congregacionNombre={congregacionActual?.nombre || ""}
              mesAnio={mesAnio}
              colorTema={colorTemaAsig}
              diasEspeciales={diasEspecialesAsignados}
              mensajesAdicionales={mensajesAdicionales}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
