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

// Nombres funcionales para las columnas técnicas más comunes entre tablas.
// Lo que no está acá cae a un formateo genérico (labelDeCampo).
const FIELD_LABELS: Record<string, string> = {
  user_id: "Usuario",
  marcado_por: "Marcado por",
  aprobado_por: "Aprobado por",
  congregacion_id: "Congregación",
  congregacion_principal_id: "Congregación principal",
  territorio_id: "Territorio",
  manzana_id: "Manzana",
  ciclo_id: "Ciclo",
  punto_encuentro_id: "Punto de encuentro",
  perfil_id: "Perfil",
  perfil_permiso_id: "Perfil",
  grupo_id: "Grupo",
  grupo_predicacion_id: "Grupo de predicación",
  grupo_servicio_id: "Grupo de servicio",
  participante_id: "Participante",
  capitan_id: "Capitán",
  presidente_id: "Presidente",
  lector_atalaya_id: "Lector de La Atalaya",
  conductor_atalaya_id: "Conductor de La Atalaya",
  lector_ebc_id: "Lector de la Escuela",
  orador_suplente_id: "Orador suplente",
  orador_saliente_id: "Orador saliente",
  fecha_trabajada: "Fecha trabajada",
  fecha_inicio: "Fecha de inicio",
  fecha_fin: "Fecha de fin",
  fecha_login: "Inicio de sesión",
  fecha_logout: "Cierre de sesión",
  nombre: "Nombre",
  apellido: "Apellido",
  email: "Email",
  activo: "Activo",
  es_principal: "Es principal",
  es_capitan_grupo: "Capitán de grupo",
  rol: "Rol",
  color_primario: "Color",
  slug: "Slug",
  numero: "Número",
  numero_salida: "Número de salida",
  telefono: "Teléfono",
  direccion: "Dirección",
  descripcion: "Descripción",
  completado: "Completado",
  bloqueado: "Bloqueado",
  ciclo_numero: "Número de ciclo",
  url_maps: "URL de Google Maps",
  codigo_publico: "Código público",
};

export function labelDeCampo(campo: string): string {
  if (FIELD_LABELS[campo]) return FIELD_LABELS[campo];
  return campo
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

interface Filtros {
  tabla?: string;
  operacion?: string;
  busqueda?: string;
  pagina: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Campos *_id con un significado propio (no una "persona"): se resuelven
// contra su tabla y columna de nombre correspondiente.
const FK_ENTIDAD: Record<string, { tabla: string; columnas: string; etiqueta: (r: Record<string, unknown>) => string }> = {
  congregacion_id: { tabla: "congregaciones", columnas: "id,nombre", etiqueta: (r) => String(r.nombre ?? "") },
  congregacion_principal_id: { tabla: "congregaciones", columnas: "id,nombre", etiqueta: (r) => String(r.nombre ?? "") },
  territorio_id: { tabla: "territorios", columnas: "id,numero,nombre", etiqueta: (r) => `Territorio ${r.numero}` },
  manzana_id: { tabla: "manzanas_territorio", columnas: "id,letra", etiqueta: (r) => `Manzana ${r.letra}` },
  ciclo_id: { tabla: "ciclos_territorio", columnas: "id,ciclo_numero", etiqueta: (r) => `Ciclo ${r.ciclo_numero}` },
  punto_encuentro_id: { tabla: "puntos_encuentro", columnas: "id,nombre", etiqueta: (r) => String(r.nombre ?? "") },
  perfil_id: { tabla: "perfiles_permisos", columnas: "id,nombre", etiqueta: (r) => String(r.nombre ?? "") },
  perfil_permiso_id: { tabla: "perfiles_permisos", columnas: "id,nombre", etiqueta: (r) => String(r.nombre ?? "") },
  grupo_id: { tabla: "grupos_predicacion", columnas: "id,nombre", etiqueta: (r) => String(r.nombre ?? "") },
  grupo_predicacion_id: { tabla: "grupos_predicacion", columnas: "id,nombre", etiqueta: (r) => String(r.nombre ?? "") },
};

// Campos *_id que apuntan a una persona: se buscan tanto en profiles (cuenta
// de usuario) como en participantes (miembro de congregación), lo que
// aparezca primero.
const FK_PERSONA_CAMPOS = new Set([
  "user_id",
  "marcado_por",
  "aprobado_por",
  "capitan_id",
  "participante_id",
  "presidente_id",
  "lector_atalaya_id",
  "conductor_atalaya_id",
  "lector_ebc_id",
  "orador_suplente_id",
  "orador_saliente_id",
]);

function recolectarIds(entradas: AuditLogEntry[], campos: Set<string> | string[]) {
  const set = new Set<string>();
  const camposArr = Array.isArray(campos) ? campos : Array.from(campos);
  for (const e of entradas) {
    for (const datos of [e.datos_anteriores, e.datos_nuevos]) {
      if (!datos) continue;
      for (const campo of camposArr) {
        const v = datos[campo];
        if (typeof v === "string" && UUID_RE.test(v)) set.add(v);
      }
    }
  }
  return set;
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

  const entradas = query.data?.entradas || [];

  // Resuelve los ids técnicos que aparecen en esta página a nombres
  // funcionales, en un solo lote de consultas por tabla referenciada.
  const { data: resolverMap = {} } = useQuery({
    queryKey: ["audit-log-resolver", entradas.map((e) => e.id).join(",")],
    queryFn: async () => {
      const mapa: Record<string, string> = {};

      await Promise.all(
        Object.entries(FK_ENTIDAD).map(async ([campo, cfg]) => {
          const ids = recolectarIds(entradas, [campo]);
          if (ids.size === 0) return;
          const { data } = await (supabase.from(cfg.tabla as never) as ReturnType<typeof supabase.from>)
            .select(cfg.columnas)
            .in("id", Array.from(ids));
          ((data || []) as Record<string, unknown>[]).forEach((r) => {
            mapa[String(r.id)] = cfg.etiqueta(r);
          });
        }),
      );

      const idsPersonas = recolectarIds(entradas, FK_PERSONA_CAMPOS);
      if (idsPersonas.size > 0) {
        const idsArr = Array.from(idsPersonas);
        const [{ data: perfiles }, { data: participantes }] = await Promise.all([
          supabase.from("profiles").select("id,nombre,apellido,email").in("id", idsArr),
          supabase.from("participantes").select("id,nombre,apellido").in("id", idsArr),
        ]);
        // participantes primero, profiles pisa encima si también matchea
        (participantes || []).forEach((r: Record<string, unknown>) => {
          const nombre = `${r.nombre ?? ""} ${r.apellido ?? ""}`.trim();
          if (nombre) mapa[String(r.id)] = nombre;
        });
        (perfiles || []).forEach((r: Record<string, unknown>) => {
          const nombre = `${r.nombre ?? ""} ${r.apellido ?? ""}`.trim() || String(r.email ?? "");
          if (nombre) mapa[String(r.id)] = nombre;
        });
      }

      return mapa;
    },
    enabled: esSuperAdmin && entradas.length > 0,
  });

  return {
    entradas,
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    pageSize: PAGE_SIZE,
    resolverMap,
  };
}
