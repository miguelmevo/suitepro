import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParticipantes } from "@/hooks/useParticipantes";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCongregacion } from "@/contexts/CongregacionContext";
import type { ParticipanteFiltro } from "@/types/vida-ministerio";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  filtro: ParticipanteFiltro;
  placeholder?: string;
  disabled?: boolean;
}

const NONE = "__none__";

export function ParticipanteSelector({ value, onChange, filtro, placeholder = "Seleccionar...", disabled }: Props) {
  const { participantes, isLoading } = useParticipantes();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id;

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

  const filtrados = useMemo(() => {
    const base = (participantes ?? []).filter(
      (p) => p.activo && !p.es_publicador_inactivo
    );
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
      case "publicador":
        return base;
      case "lector_atalaya":
        return base.filter((p) => lectoresElegibles?.includes(p.id));
      case "superintendente_circuito":
        return base.filter((p) => p.responsabilidad?.includes("super_circuito"));
      case "aprobado":
        return base.filter((p) => (p as any).estado_aprobado === true);
      case "cualquiera":
      default:
        return base;
    }
  }, [participantes, filtro, lectoresElegibles]);

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— Sin asignar —</SelectItem>
        {filtrados.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.apellido}, {p.nombre}
          </SelectItem>
        ))}
        {filtrados.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No hay participantes que cumplan el filtro
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
