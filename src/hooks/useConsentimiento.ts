import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { VERSION_CONSENTIMIENTO } from "@/lib/consentimiento";

const db = supabase as any;

/** Estado del consentimiento del usuario actual en la congregación activa. */
export function useConsentimiento() {
  const { user } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id ?? null;
  const queryClient = useQueryClient();
  const { getConfigValue, isLoading: cargandoConfig } = useConfiguracionSistema("general");
  const obligatorio = getConfigValue("consentimiento")?.obligatorio === true;

  const query = useQuery({
    queryKey: ["consentimiento", user?.id, congregacionId, VERSION_CONSENTIMIENTO],
    queryFn: async () => {
      const { data, error } = await db
        .from("consentimientos")
        .select("id")
        .eq("user_id", user!.id)
        .eq("congregacion_id", congregacionId)
        .eq("version", VERSION_CONSENTIMIENTO)
        .is("revocado_at", null)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id && !!congregacionId,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["consentimiento"] });
    queryClient.invalidateQueries({ queryKey: ["consentimientos-congregacion"] });
  };

  const aceptar = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("registrar_consentimiento", {
        _congregacion_id: congregacionId,
        _version: VERSION_CONSENTIMIENTO,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const revocar = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("revocar_consentimiento", { _congregacion_id: congregacionId });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  return {
    congregacionId,
    obligatorio,
    aceptado: query.data ?? false,
    cargando: query.isLoading || cargandoConfig,
    aceptar,
    revocar,
  };
}
