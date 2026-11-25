import { supabase } from "@/integrations/supabase/client";

/** Situación de un territorio antes de registrar manzanas. */
export interface EstadoRegistroManzanas {
  /** La congregación bloquea el reenvío durante 12 horas (Ajustes > Predicación). */
  bloqueo_activo: boolean;
  /** IDs de las manzanas enviadas hace menos de 12 horas. */
  recientes: string[];
}

export async function obtenerEstadoRegistroManzanas(territorioId: string): Promise<EstadoRegistroManzanas> {
  const { data, error } = await (supabase.rpc as any)("get_estado_registro_manzanas", {
    _territorio_id: territorioId,
  });
  if (error) throw error;
  return data as EstadoRegistroManzanas;
}
