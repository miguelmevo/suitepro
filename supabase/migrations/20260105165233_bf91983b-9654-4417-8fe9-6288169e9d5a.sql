-- Actualizar la función get_participantes_seguros para filtrar por congregacion_id
CREATE OR REPLACE FUNCTION public.get_participantes_seguros()
 RETURNS TABLE(id uuid, nombre text, apellido text, telefono text, estado_aprobado boolean, responsabilidad text[], responsabilidad_adicional text, grupo_predicacion_id uuid, restriccion_disponibilidad text, es_capitan_grupo boolean, activo boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.nombre,
    p.apellido,
    p.telefono,
    p.estado_aprobado,
    p.responsabilidad,
    p.responsabilidad_adicional,
    p.grupo_predicacion_id,
    p.restriccion_disponibilidad,
    p.es_capitan_grupo,
    p.activo,
    p.created_at,
    p.updated_at
  FROM public.participantes p
  WHERE p.activo = true
    AND p.congregacion_id = get_user_congregacion_id()
    AND is_admin_or_editor_in_congregacion(p.congregacion_id)
$function$;