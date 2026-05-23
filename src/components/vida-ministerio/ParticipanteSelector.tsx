import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParticipantes } from "@/hooks/useParticipantes";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useAuth } from "@/hooks/useAuth";
import { CrearParticipanteRapidoModal } from "@/components/participantes/CrearParticipanteRapidoModal";
import { toast } from "sonner";
import type { ParticipanteFiltro } from "@/types/vida-ministerio";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  filtro: ParticipanteFiltro;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const NONE = "__none__";
const ADD_NEW = "__add_new__";

// Verifica si un participante recién creado cumple el filtro del slot
function cumpleFiltro(
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
    case "aprobado":
      // Oraciones: solo varones, sin EMC
      return p.estado_aprobado === true && p.genero === "M";
    default:
      return true;
  }
}

export function ParticipanteSelector({ value, onChange, filtro, placeholder = "Seleccionar...", disabled, className }: Props) {
  const { participantes, isLoading } = useParticipantes();
  const { congregacionActual } = useCongregacion();
  const { isAdminOrEditorInCongregacion, isSuperAdmin } = useAuth();
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
    switch (filtro) {
      case "anciano":
        return base.filter((p) => p.responsabilidad?.includes("anciano"));
      case "anciano_o_sm":
        return base.filter(
          (p) =>
            p.responsabilidad?.includes("anciano") ||
            p.responsabilidad?.includes("siervo_ministerial")
        );
      case "anciano_o_sm_varon":
        return base.filter(
          (p) =>
            (p as any).genero === "M" &&
            (p.responsabilidad?.includes("anciano") ||
              p.responsabilidad?.includes("siervo_ministerial"))
        );
      case "varon_publicador":
        return base.filter((p) => (p as any).genero === "M");
      case "varon_emc":
        return base.filter((p) => (p as any).genero === "M");
      case "publicador":
        return base;
      case "lector_atalaya":
        return base.filter((p) => lectoresElegibles?.includes(p.id));
      case "lector_ebc":
        return base.filter((p) => lectoresEbc?.includes(p.id));
      case "superintendente_circuito":
        return base.filter((p) => p.responsabilidad?.includes("super_circuito"));
      case "aprobado":
        // Oraciones: solo varones aprobados, sin requisito EMC
        return base.filter(
          (p) => (p as any).estado_aprobado === true && (p as any).genero === "M"
        );
      case "cualquiera":
      default:
        return base;
    }
  }, [participantes, filtro, lectoresElegibles, lectoresEbc]);

  const handleCreated = (nuevoId: string) => {
    // Buscar el participante recién creado en la lista actualizada (puede tardar un tick)
    // Usamos un pequeño poll para esperar la invalidación de la query
    const tryAssign = (attempt = 0) => {
      const nuevo = (participantes ?? []).find((p) => p.id === nuevoId);
      if (nuevo) {
        if (cumpleFiltro(nuevo as any, filtro, lectoresElegibles, lectoresEbc)) {
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
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Sin asignar —</SelectItem>
          {filtrados.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.apellido}, {p.nombre}
              {(p as any).alias ? ` (${(p as any).alias})` : ""}
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
