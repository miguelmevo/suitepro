import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";

export interface AuditLogEntry {
  id: string;
  tabla: string;
  registro_id: string | null;
  operacion: "INSERT" | "UPDATE" | "DELETE";
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  campos_modificados: string[] | null;
  user_id: string | null;
  user_email: string | null;
  congregacion_id: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

// Mismo listado de tablas auditadas que la migración del trigger genérico
// (supabase/migrations/20260822130000_audit_log.sql). Se mantiene acá como
// lista estática para el filtro, así aparecen todas aunque una todavía no
// tenga ningún registro.
export const TABLAS_AUDITADAS = [
  "asignaciones_capitan_fijas",
  "asignaciones_servicio_dias_especiales",
  "carritos",
  "ciclos_territorio",
  "conductores_atalaya",
  "configuracion_sistema",
  "congregaciones",
  "dias_especiales",
  "direcciones_bloqueadas",
  "disponibilidad_capitanes",
  "grupos_predicacion",
  "grupos_predicacion_ficticios",
  "grupos_servicio",
  "horarios_salida",
  "indisponibilidad_participantes",
  "manzanas_territorio",
  "manzanas_trabajadas",
  "mensajes_adicionales",
  "miembros_grupo",
  "participantes",
  "perfiles_permisos",
  "permisos_usuario_congregacion",
  "plantillas_vida_ministerio_oficial",
  "profiles",
  "programa_asignaciones_servicio",
  "programa_predicacion",
  "programa_reunion_publica",
  "programa_vida_ministerio",
  "programas_publicados",
  "puntos_encuentro",
  "reunion_publica_dias_especiales",
  "territorios",
  "territorios_grupos_predicacion",
  "tipos_programa",
  "user_roles",
  "usuario_perfiles_asignados",
  "usuarios_congregacion",
].sort();

interface Filtros {
  tabla?: string;
  operacion?: string;
  busqueda?: string;
  pagina: number;
}

export function useAuditLog(filtros: Filtros) {
  const { isSuperAdmin } = useAuthContext();
  const esSuperAdmin = isSuperAdmin();

  const query = useQuery({
    queryKey: ["audit-log", filtros.tabla, filtros.operacion, filtros.busqueda, filtros.pagina],
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(filtros.pagina * PAGE_SIZE, filtros.pagina * PAGE_SIZE + PAGE_SIZE - 1);

      if (filtros.tabla) q = q.eq("tabla", filtros.tabla);
      if (filtros.operacion) q = q.eq("operacion", filtros.operacion);
      if (filtros.busqueda) q = q.ilike("user_email", `%${filtros.busqueda}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { entradas: (data || []) as AuditLogEntry[], total: count || 0 };
    },
    enabled: esSuperAdmin,
  });

  return {
    entradas: query.data?.entradas || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    pageSize: PAGE_SIZE,
  };
}
