
-- 1) historial_sesiones: restringir INSERT a authenticated y permitir SELECT/DELETE propios
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.historial_sesiones;
CREATE POLICY "Users can insert their own sessions"
  ON public.historial_sesiones
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own sessions" ON public.historial_sesiones;
CREATE POLICY "Users can view their own sessions"
  ON public.historial_sesiones
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.historial_sesiones;
CREATE POLICY "Users can delete their own sessions"
  ON public.historial_sesiones
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 2) is_admin_or_editor_in_congregacion: quitar el fallback genérico por permisos granulares.
-- Cada módulo debe validar su propio permiso vía has_permission o can_edit_*.
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
    );
$function$;
