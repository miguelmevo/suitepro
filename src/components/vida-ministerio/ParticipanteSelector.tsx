import { useMemo, useState } from "react";
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useParticipantes } from "@/hooks/useParticipantes";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useAuth } from "@/hooks/useAuth";
import { CrearParticipanteRapidoModal } from "@/components/participantes/CrearParticipanteRapidoModal";
import { toast } from "sonner";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import {
  computeUltimasParticipaciones,
  ultimaGlobal,
  CATEGORIAS_ORDEN,
  CATEGORIA_LABEL,
  CATEGORIA_LABEL_CORTO,
  type VymCategoria,
} from "@/lib/vida-ministerio-historial";
import {
  computeBloqueo,
  leerBloqueoConfig,
  esCategoriaOracion,
} from "@/lib/vida-ministerio-bloqueos";
import type { ParticipanteFiltro } from "@/types/vida-ministerio";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  filtro: ParticipanteFiltro;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Si true y el filtro es "anciano_o_sm", respeta el toggle sm_habilitado_maestros (excluye SM si está desactivado). */
  respetarSmHabilitado?: boolean;
  /** Categoría VyM del slot. Si se pasa junto con fechaPrograma, se aplica el bloqueo por rotación y descanso global. */
  categoria?: VymCategoria;
  /** Fecha del programa (YYYY-MM-DD) que se está editando. */
  fechaPrograma?: string;
  /** Nombre guardado al momento de asignar (nombres_snapshot del programa). Se usa como
   *  último recurso si el participante ya no existe en la base (fue eliminado). */
  snapshotNombre?: string | null;
}

const NONE = "__none__";
const ADD_NEW = "__add_new__";

// Verifica si un participante recién creado cumple el filtro del slot
export function cumpleFiltro(
  p: any,
  filtro: ParticipanteFiltro,
  lectoresElegibles?: string[],
  lectoresEbc?: string[]
): boolean {
  if (!p?.activo || p?.es_publicador_inactivo) return false;
  // Regla transversal: EMC requerido para todos los slots de VyM,
  // EXCEPTO oraciones (aprobado) y las listas curadas (lector_atalaya, lector_ebc).
  const exentoEmc = filtro === "aprobado" || filtro === "lector_atalaya" || filtro === "lector_ebc";
  if (!exentoEmc && p.inscrito_emc !== true) return false;

  switch (filtro) {
    case "anciano":
      return !!p.responsabilidad?.includes("anciano");
    case "anciano_o_sm":
      return !!(p.responsabilidad?.includes("anciano") || p.responsabilidad?.includes("siervo_ministerial"));
    case "anciano_o_sm_varon":
      return (
        p.genero === "M" &&
        !!(p.responsabilidad?.includes("anciano") || p.responsabilidad?.includes("siervo_ministerial"))
      );
    case "varon_publicador":
      return p.genero === "M";
    case "varon_emc":
      return p.genero === "M";
    case "publicador":
    case "cualquiera":
      return true;
    case "lector_atalaya":
      return !!lectoresElegibles?.includes(p.id);
    case "lector_ebc":
      return !!lectoresEbc?.includes(p.id);
    case "superintendente_circuito":
      return !!p.responsabilidad?.includes("super_circuito");
    case "aprobado": {
      // Oraciones: solo varones aprobados con responsabilidad PB, A, SM o SC
      const resp = p.responsabilidad ?? [];
      const tieneResp =
        resp.includes("publicador") ||
        resp.includes("anciano") ||
        resp.includes("siervo_ministerial") ||
        resp.includes("super_circuito");
      return p.estado_aprobado === true && p.genero === "M" && tieneResp;
    }
    default:
      return true;
  }
}

export function ParticipanteSelector({ value, onChange, filtro, placeholder = "Seleccionar...", disabled, className, respetarSmHabilitado, categoria, fechaPrograma, snapshotNombre }: Props) {
  const { participantes, todosParticipantes, isLoading } = useParticipantes();
  const { congregacionActual } = useCongregacion();
  const { isAdminOrEditorInCongregacion, isSuperAdmin } = useAuth();
  const { getConfigValue, configuraciones } = useConfiguracionSistema("vida_ministerio");
  const smHabilitado = (getConfigValue("sm_habilitado_maestros")?.habilitado as boolean | undefined) ?? true;
  const excluirSm = respetarSmHabilitado === true && filtro === "anciano_o_sm" && smHabilitado === false;
  const congregacionId = congregacionActual?.id;
  const [modalOpen, setModalOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const puedeCrear = !!congregacionId && (isSuperAdmin() || isAdminOrEditorInCongregacion(congregacionId));

  // Para el filtro "lector_atalaya" necesitamos los IDs elegibles
  const { data: lectoresElegibles } = useQuery({
    queryKey: ["lectores-atalaya-elegibles", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];
      const { data, error } = await supabase
        .from("lectores_atalaya_elegibles")
        .select("participante_id")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true);
      if (error) throw error;
      return data?.map((d) => d.participante_id) ?? [];
    },
    enabled: !!congregacionId && filtro === "lector_atalaya",
  });

  // Para el filtro "lector_ebc" necesitamos los IDs elegibles de la lista EBC
  const { data: lectoresEbc } = useQuery({
    queryKey: ["lectores-ebc-elegibles-ids", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];
      const { data, error } = await supabase
        .from("lectores_ebc_elegibles")
        .select("participante_id")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true);
      if (error) throw error;
      return data?.map((d) => d.participante_id) ?? [];
    },
    enabled: !!congregacionId && filtro === "lector_ebc",
  });

  // Última participación por categoría (para mostrar pista en cada item del selector)
  const { data: programasVym } = useProgramasVidaMinisterio();
  const ultimasMap = useMemo(
    () => computeUltimasParticipaciones(programasVym ?? []),
    [programasVym]
  );

  const formatFechaCorta = (fecha: string) => {
    try {
      return format(parseISO(fecha), "d MMM yy", { locale: es });
    } catch {
      return fecha;
    }
  };

  const buildTitleTooltip = (id: string) => {
    const entry = ultimasMap.get(id);
    if (!entry) return "Sin participaciones previas";
    return CATEGORIAS_ORDEN.map((cat) => {
      const arr = entry[cat] ?? [];
      if (arr.length === 0) return `${CATEGORIA_LABEL[cat]}: —`;
      const fechasStr = arr
        .map((e) => `${formatFechaCorta(e.fecha)}${cat === "maestros" && e.rol ? ` (${e.rol})` : ""}`)
        .join(", ");
      return `${CATEGORIA_LABEL[cat]}: ${fechasStr}`;
    }).join("\n");
  };

  const buildInlineUltima = (id: string) => {
    const entry = ultimasMap.get(id);
    const g = ultimaGlobal(entry);
    if (!g) return "nunca";
    return `últ: ${formatFechaCorta(g.fecha)} (${CATEGORIA_LABEL_CORTO[g.categoria]}${
      g.rol ? ` ${g.rol}` : ""
    })`;
  };


  const filtrados = useMemo(() => {
    // Base: activos y no inactivos
    let base = (participantes ?? []).filter(
      (p) => p.activo && !p.es_publicador_inactivo
    );
    // Regla transversal EMC, excepto oraciones y listas curadas
    const exentoEmc = filtro === "aprobado" || filtro === "lector_atalaya" || filtro === "lector_ebc";
    if (!exentoEmc) {
      base = base.filter((p) => (p as any).inscrito_emc === true);
    }
    let result: typeof base;
    switch (filtro) {
      case "anciano":
        result = base.filter((p) => p.responsabilidad?.includes("anciano"));
        break;
      case "anciano_o_sm":
        result = base.filter(
          (p) =>
            p.responsabilidad?.includes("anciano") ||
            (!excluirSm && p.responsabilidad?.includes("siervo_ministerial"))
        );
        break;
      case "anciano_o_sm_varon":
        result = base.filter(
          (p) =>
            (p as any).genero === "M" &&
            (p.responsabilidad?.includes("anciano") ||
              p.responsabilidad?.includes("siervo_ministerial"))
        );
        break;
      case "varon_publicador":
      case "varon_emc":
        result = base.filter((p) => (p as any).genero === "M");
        break;
      case "publicador":
        result = base;
        break;
      case "lector_atalaya":
        result = base.filter((p) => lectoresElegibles?.includes(p.id));
        break;
      case "lector_ebc":
        result = base.filter((p) => lectoresEbc?.includes(p.id));
        break;
      case "superintendente_circuito":
        result = base.filter((p) => p.responsabilidad?.includes("super_circuito"));
        break;
      case "aprobado":
        result = base.filter((p) => {
          const resp = (p as any).responsabilidad ?? [];
          const tieneResp =
            resp.includes("publicador") ||
            resp.includes("anciano") ||
            resp.includes("siervo_ministerial") ||
            resp.includes("super_circuito");
          return (p as any).estado_aprobado === true && (p as any).genero === "M" && tieneResp;
        });
        break;
      case "cualquiera":
      default:
        result = base;
    }
    // Ordenar por última participación ASC: primero los que hace más tiempo (o nunca),
    // al final los más recientes. Empates por apellido/nombre.
    return [...result].sort((a, b) => {
      const fa = ultimaGlobal(ultimasMap.get(a.id))?.fecha ?? "";
      const fb = ultimaGlobal(ultimasMap.get(b.id))?.fecha ?? "";
      if (fa !== fb) return fa.localeCompare(fb);
      const ap = (a.apellido || "").localeCompare(b.apellido || "");
      if (ap !== 0) return ap;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });
  }, [participantes, filtro, lectoresElegibles, lectoresEbc, excluirSm, ultimasMap]);

  // === Cómputo de bloqueos por rotación / descanso global (opción 2B con umbral) ===
  const bloqueoCfg = useMemo(() => leerBloqueoConfig(configuraciones), [configuraciones]);
  const aplicarBloqueo = !!categoria && !!fechaPrograma && !esCategoriaOracion(categoria);

  const bloqueosMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeBloqueo>>();
    if (!aplicarBloqueo) return m;
    for (const p of filtrados) {
      m.set(
        p.id,
        computeBloqueo(ultimasMap.get(p.id), categoria!, fechaPrograma!, bloqueoCfg)
      );
    }
    return m;
  }, [aplicarBloqueo, filtrados, ultimasMap, categoria, fechaPrograma, bloqueoCfg]);

  const totalDisponibles = useMemo(() => {
    if (!aplicarBloqueo) return filtrados.length;
    let c = 0;
    for (const p of filtrados) if (!bloqueosMap.get(p.id)?.bloqueado) c++;
    return c;
  }, [aplicarBloqueo, filtrados, bloqueosMap]);

  const permitirBloqueados = aplicarBloqueo
    ? totalDisponibles < bloqueoCfg.umbralRelajacion
    : true;


  const handleCreated = (nuevoId: string) => {
    // Buscar el participante recién creado en la lista actualizada (puede tardar un tick)
    // Usamos un pequeño poll para esperar la invalidación de la query
    const tryAssign = (attempt = 0) => {
      const nuevo = (participantes ?? []).find((p) => p.id === nuevoId);
      if (nuevo) {
        const okFiltro = cumpleFiltro(nuevo as any, filtro, lectoresElegibles, lectoresEbc);
        const okSm = !(excluirSm && (nuevo as any).responsabilidad?.includes("siervo_ministerial") && !(nuevo as any).responsabilidad?.includes("anciano"));
        if (okFiltro && okSm) {
          onChange(nuevoId);
          toast.success("Participante creado y asignado");
        } else {
          toast.info("Participante creado, pero no cumple el filtro de este slot");
        }
        return;
      }
      if (attempt < 10) setTimeout(() => tryAssign(attempt + 1), 150);
    };
    tryAssign();
  };

  const seleccionado = value ? (participantes ?? []).find((p) => p.id === value) : null;
  // Si no está activo/elegible, buscar igual en todosParticipantes (inactivado) para
  // mostrar su nombre real; si tampoco existe (fue eliminado), caer al snapshot guardado.
  const seleccionadoInactivo = !seleccionado && value ? (todosParticipantes ?? []).find((p) => p.id === value) : null;
  const nombreNoDisponible = !seleccionado && !seleccionadoInactivo && value
    ? (snapshotNombre || "(participante no disponible)")
    : null;

  const handleSelect = (v: string) => {
    if (v === ADD_NEW) {
      setPopoverOpen(false);
      setModalOpen(true);
      return;
    }
    onChange(v === NONE ? null : v);
    setPopoverOpen(false);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={popoverOpen}
            disabled={disabled || isLoading}
            className={cn("w-full justify-between font-normal", className)}
          >
            {seleccionado ? (
              <span className="truncate">
                {seleccionado.apellido}, {seleccionado.nombre}
                {(seleccionado as any).alias ? ` (${(seleccionado as any).alias})` : ""}
              </span>
            ) : seleccionadoInactivo ? (
              <span className="truncate italic text-muted-foreground" title="Participante inactivado">
                {seleccionadoInactivo.apellido}, {seleccionadoInactivo.nombre}
              </span>
            ) : nombreNoDisponible ? (
              <span className="truncate italic text-muted-foreground" title="Participante eliminado de la congregación">
                {nombreNoDisponible}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          showOverlay={false}
          className="w-[--radix-popover-trigger-width] p-0 bg-popover border shadow-lg z-[100]"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Buscar participante..." />
            <CommandList
              className="max-h-[45vh] overflow-y-auto overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <CommandEmpty>No se encontraron participantes.</CommandEmpty>
              {aplicarBloqueo && totalDisponibles < bloqueoCfg.umbralRelajacion && (
                <div className="px-2 py-1 text-[10px] text-amber-700 dark:text-amber-400 border-b">
                  ⚠ Pocos participantes disponibles ({totalDisponibles}). Se permiten bloqueados.
                </div>
              )}
              <CommandGroup>
                <CommandItem value="__sin_asignar__" onSelect={() => handleSelect(NONE)}>
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  — Sin asignar —
                </CommandItem>
                {filtrados.map((p) => {
                  const bloqueo = bloqueosMap.get(p.id);
                  const estaMarcado = !!bloqueo?.marcado; // aviso visual (con o sin toggle)
                  const estaBloqueado = !!bloqueo?.bloqueado; // solo cuando el toggle está activo
                  const deshabilitar = estaBloqueado && !permitirBloqueados;
                  const tooltip = estaMarcado && bloqueo?.detalle
                    ? `${bloqueo.detalle}\n\n${buildTitleTooltip(p.id)}`
                    : buildTitleTooltip(p.id);
                  // Si el participante actualmente seleccionado está bloqueado,
                  // permitir mantenerlo (no lo deshabilitamos) para no perder la selección.
                  const esSeleccionado = value === p.id;
                  const alias = (p as any).alias ? ` (${(p as any).alias})` : "";
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.apellido} ${p.nombre}${alias} ${p.id}`}
                      title={tooltip}
                      disabled={deshabilitar && !esSeleccionado}
                      onSelect={() => handleSelect(p.id)}
                      className={cn(estaBloqueado && "opacity-70")}
                    >
                      <Check className={cn("mr-2 h-4 w-4 shrink-0", esSeleccionado ? "opacity-100" : "opacity-0")} />
                      <span className="flex flex-col">
                        <span className="flex items-center gap-1">
                          {estaMarcado && (
                            <span
                              className={cn(
                                "inline-block text-[9px] font-bold px-1 rounded",
                                bloqueo?.motivo === "rotacion"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              )}
                            >
                              {bloqueo?.motivo === "rotacion" ? "ROT" : "DESC"}
                            </span>
                          )}
                          <span>
                            {p.apellido}, {p.nombre}
                            {alias}
                          </span>
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {estaMarcado && bloqueo?.detalle ? bloqueo.detalle : buildInlineUltima(p.id)}
                        </span>
                      </span>
                    </CommandItem>
                  );
                })}
                {puedeCrear && (
                  <CommandItem
                    value="__agregar_nuevo__"
                    onSelect={() => handleSelect(ADD_NEW)}
                    className="text-primary font-medium"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar nuevo
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {puedeCrear && (
        <CrearParticipanteRapidoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
