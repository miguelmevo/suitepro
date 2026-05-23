ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS alias text;

DROP FUNCTION IF EXISTS public.get_participantes_seguros(uuid);

CREATE OR REPLACE FUNCTION public.get_participantes_seguros(_congregacion_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, nombre text, apellido text, telefono text, estado_aprobado boolean, responsabilidad text[], responsabilidad_adicional text, grupo_predicacion_id uuid, restriccion_disponibilidad text, es_capitan_grupo boolean, es_publicador_inactivo boolean, activo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, genero text, es_casado boolean, tiene_hijos boolean, inscrito_emc boolean, alias text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id, p.nombre, p.apellido,
    CASE 
      WHEN is_admin_or_editor_in_congregacion(p.congregacion_id) THEN p.telefono
      ELSE NULL
    END as telefono,
    p.estado_aprobado, p.responsabilidad, p.responsabilidad_adicional, p.grupo_predicacion_id,
    p.restriccion_disponibilidad, p.es_capitan_grupo, p.es_publicador_inactivo,
    p.activo, p.created_at, p.updated_at, p.user_id, p.genero,
    p.es_casado, p.tiene_hijos, p.inscrito_emc, p.alias
  FROM public.participantes p
  WHERE p.congregacion_id = COALESCE(_congregacion_id, get_user_congregacion_id())
$function$;