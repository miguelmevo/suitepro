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
  es_publicador_inactivo boolean,
  activo boolean,
  created_at timestamptz,
  updated_at timestamptz,
  user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id, 
    p.nombre, 
    p.apellido,
    CASE 
      WHEN is_admin_or_editor_in_congregacion(p.congregacion_id) THEN p.telefono
      ELSE NULL
    END as telefono,
    p.estado_aprobado,
    p.responsabilidad, 
    p.responsabilidad_adicional, 
    p.grupo_predicacion_id,
    p.restriccion_disponibilidad, 
    p.es_capitan_grupo, 
    p.es_publicador_inactivo,
    p.activo,
    p.created_at, 
    p.updated_at, 
    p.user_id
  FROM public.participantes p
  WHERE p.congregacion_id = get_user_congregacion_id()
$$;