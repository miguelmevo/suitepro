
-- Eliminar y recrear la función con user_id
DROP FUNCTION IF EXISTS public.get_participantes_seguros();

CREATE FUNCTION public.get_participantes_seguros()
RETURNS TABLE(
  id uuid, 
  nombre text, 
  apellido text, 
  telefono text, 
  estado_aprobado boolean, 
  responsabilidad text[], 
  responsabilidad_adicional text, 
  grupo_predicacion_id uuid, 
  restriccion_disponibilidad text, 
  es_capitan_grupo boolean, 
  activo boolean, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone,
  user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id, p.nombre, p.apellido, p.telefono, p.estado_aprobado,
    p.responsabilidad, p.responsabilidad_adicional, p.grupo_predicacion_id,
    p.restriccion_disponibilidad, p.es_capitan_grupo, p.activo,
    p.created_at, p.updated_at, p.user_id
  FROM public.participantes p
  WHERE p.activo = true
    AND p.congregacion_id = get_user_congregacion_id()
    AND is_admin_or_editor_in_congregacion(p.congregacion_id)
$$;
