-- Actualizar la función get_participantes_seguros para:
-- 1. Permitir que TODOS los miembros de la congregación vean participantes
-- 2. Enmascarar teléfonos para usuarios que NO son admin/editor/super_admin

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
  updated_at timestamp with time zone, 
  user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id, 
    p.nombre, 
    p.apellido,
    -- Enmascarar teléfono si el usuario NO es admin/editor/super_admin
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
    p.activo,
    p.created_at, 
    p.updated_at, 
    p.user_id
  FROM public.participantes p
  WHERE p.activo = true
    AND p.congregacion_id = get_user_congregacion_id()
$$;

-- Eliminar política de lectura directa que expone teléfonos
DROP POLICY IF EXISTS "Usuarios pueden ver participantes de su congregación" ON public.participantes;

-- Crear política restrictiva: solo admin/editor pueden leer directamente
-- Los usuarios regulares DEBEN usar get_participantes_seguros()
CREATE POLICY "Solo admin/editor pueden leer participantes directamente"
ON public.participantes
FOR SELECT
USING (
  congregacion_id = get_user_congregacion_id()
  AND is_admin_or_editor_in_congregacion(congregacion_id)
);