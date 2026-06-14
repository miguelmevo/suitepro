
CREATE OR REPLACE FUNCTION public.can_edit_predicacion(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion
    WHERE user_id = auth.uid()
      AND congregacion_id = _congregacion_id
      AND rol IN ('admin','editor','super_admin','sservicio')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), _congregacion_id, 'programa_predicacion', 'editar')
  OR public.has_permission(auth.uid(), _congregacion_id, 'programa_predicacion', 'crear');
$$;

-- programa_predicacion
DROP POLICY IF EXISTS "Admin y Editor pueden crear programa en su congregación" ON public.programa_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar programa de su congregación" ON public.programa_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar programa de su congregación" ON public.programa_predicacion;

CREATE POLICY "Editores predicacion pueden crear programa"
  ON public.programa_predicacion FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_predicacion(congregacion_id));

CREATE POLICY "Editores predicacion pueden actualizar programa"
  ON public.programa_predicacion FOR UPDATE TO authenticated
  USING (public.can_edit_predicacion(congregacion_id))
  WITH CHECK (public.can_edit_predicacion(congregacion_id));

CREATE POLICY "Editores predicacion pueden eliminar programa"
  ON public.programa_predicacion FOR DELETE TO authenticated
  USING (public.can_edit_predicacion(congregacion_id));

-- mensajes_adicionales (mismo flujo, mismo screen)
DO $do$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, cmd FROM pg_policies
    WHERE schemaname='public' AND tablename='mensajes_adicionales'
      AND (qual LIKE '%is_admin_or_editor_in_congregacion%' OR with_check LIKE '%is_admin_or_editor_in_congregacion%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mensajes_adicionales', pol.policyname);
  END LOOP;
END
$do$;

CREATE POLICY "Editores predicacion pueden crear mensajes"
  ON public.mensajes_adicionales FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_predicacion(congregacion_id));

CREATE POLICY "Editores predicacion pueden actualizar mensajes"
  ON public.mensajes_adicionales FOR UPDATE TO authenticated
  USING (public.can_edit_predicacion(congregacion_id))
  WITH CHECK (public.can_edit_predicacion(congregacion_id));

CREATE POLICY "Editores predicacion pueden eliminar mensajes"
  ON public.mensajes_adicionales FOR DELETE TO authenticated
  USING (public.can_edit_predicacion(congregacion_id));
