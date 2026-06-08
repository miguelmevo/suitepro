-- Opción A: Las funciones legacy ahora respetan los permisos granulares.
-- Si el usuario tiene una matriz de permisos asignada en la congregación,
-- esa matriz toma precedencia. Si no, se conserva el rol legacy como antes.

-- 1) can_edit_asignaciones_servicio: añadir fallback a permisos granulares
CREATE OR REPLACE FUNCTION public.can_edit_asignaciones_servicio(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion
    WHERE user_id = auth.uid()
      AND congregacion_id = _congregacion_id
      AND rol IN ('admin','editor','super_admin','saservicio')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), _congregacion_id, 'asignaciones_servicio', 'editar')
  OR public.has_permission(auth.uid(), _congregacion_id, 'asignaciones_servicio', 'crear');
$function$;

-- 2) is_admin_or_editor_in_congregacion: si el usuario tiene matriz granular,
--    se considera "admin/editor" cuando tiene puede_editar=true en al menos
--    un módulo de esa congregación. De lo contrario, conserva el rol legacy.
CREATE OR REPLACE FUNCTION public.is_admin_or_editor_in_congregacion(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios_congregacion
      WHERE user_id = auth.uid()
        AND congregacion_id = _congregacion_id
        AND rol IN ('admin', 'editor', 'super_admin')
        AND activo = true
    )
    OR EXISTS (
      SELECT 1 FROM public.permisos_usuario_congregacion
      WHERE user_id = auth.uid()
        AND congregacion_id = _congregacion_id
        AND puede_editar = true
    );
$function$;