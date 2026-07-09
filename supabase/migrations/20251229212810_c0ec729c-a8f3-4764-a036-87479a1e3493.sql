-- Actualizar la función para que solo admin/editor puedan ver participantes
-- Los usuarios normales no podrán ver ningún dato de participantes

CREATE OR REPLACE FUNCTION public.get_participantes_seguros()
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
  updated_at timestamp with time zone
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
    p.telefono, -- Solo admin/editor pueden ver, así que mostramos el teléfono completo
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
    AND is_admin_or_editor(auth.uid()) -- Solo devolver datos si el usuario es admin o editor
$$;