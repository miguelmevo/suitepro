CREATE OR REPLACE FUNCTION public.can_edit_vida_ministerio(_congregacion_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion
    WHERE user_id = auth.uid()
      AND congregacion_id = _congregacion_id
      AND rol IN ('admin','editor','super_admin','svministerio')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), _congregacion_id, 'vym_programa', 'editar')
  OR public.has_permission(auth.uid(), _congregacion_id, 'vym_programa', 'crear')
  OR public.has_permission(auth.uid(), _congregacion_id, 'vym_historial', 'editar')
  OR public.has_permission(auth.uid(), _congregacion_id, 'vym_historial', 'crear');
$function$;