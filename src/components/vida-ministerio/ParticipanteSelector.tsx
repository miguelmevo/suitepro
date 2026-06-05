import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function ParticipanteSelector({ value, onChange, filtro, placeholder = "Seleccionar...", disabled, className, respetarSmHabilitado, categoria, fechaPrograma }: Props) {
  const { participantes, isLoading } = useParticipantes();
  const { congregacionActual } = useCongregacion();
  const { isAdminOrEditorInCongregacion, isSuperAdmin } = useAuth();
  const { getConfigValue, configuraciones } = useConfiguracionSistema("vida_ministerio");
  const smHabilitado = (getConfigValue("sm_habilitado_maestros")?.habilitado as boolean | undefined) ?? true;
  const excluirSm = respetarSmHabilitado === true && filtro === "anciano_o_sm" && smHabilitado === false;
  const congregacionId = congregacionActual?.id;
  const [modalOpen, setModalOpen] = useState(false);

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

  return (
    <>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => {
          if (v === ADD_NEW) {
            setModalOpen(true);
            return;
          }
          onChange(v === NONE ? null : v);
        }}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className={cn("w-full", className)}>
          {(() => {
            const selected = value ? (participantes ?? []).find((p) => p.id === value) : null;
            if (!selected) return <SelectValue placeholder={placeholder} />;
            return (
              <span className="truncate">
                {selected.apellido}, {selected.nombre}
                {(selected as any).alias ? ` (${(selected as any).alias})` : ""}
              </span>
            );
          })()}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Sin asignar —</SelectItem>
          {filtrados.map((p) => (
            <SelectItem key={p.id} value={p.id} title={buildTitleTooltip(p.id)}>
              <span className="flex flex-col">
                <span>
                  {p.apellido}, {p.nombre}
                  {(p as any).alias ? ` (${(p as any).alias})` : ""}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {buildInlineUltima(p.id)}
                </span>
              </span>
            </SelectItem>
          ))}
          {filtrados.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No hay participantes que cumplan el filtro
            </div>
          )}
          {puedeCrear && (
            <SelectItem value={ADD_NEW} className="text-primary font-medium">
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Agregar nuevo
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

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
