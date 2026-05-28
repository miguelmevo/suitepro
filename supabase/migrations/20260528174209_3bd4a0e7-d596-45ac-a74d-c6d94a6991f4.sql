
-- 1. Restrict user_roles writes to super_admin only (prevents privilege escalation)
DROP POLICY IF EXISTS "Solo admin puede asignar roles" ON public.user_roles;
DROP POLICY IF EXISTS "Solo admin puede modificar roles" ON public.user_roles;
DROP POLICY IF EXISTS "Solo admin puede eliminar roles" ON public.user_roles;

CREATE POLICY "Solo super_admin puede asignar roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Solo super_admin puede modificar roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Solo super_admin puede eliminar roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 2. Remove sservicio/srpublica from broad admin/editor check
CREATE OR REPLACE FUNCTION public.is_admin_or_editor_in_congregacion(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion
    WHERE user_id = auth.uid()
      AND congregacion_id = _congregacion_id
      AND rol IN ('admin', 'editor', 'super_admin')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
$function$;

-- 3. Storage territory: validate UUID actually belongs to a real territory in that congregation
CREATE OR REPLACE FUNCTION public.storage_territorio_congregacion_id(_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT t.congregacion_id
  FROM public.territorios t
  WHERE t.congregacion_id::text = split_part(split_part(_name, '/', 2), '_', 1)
  LIMIT 1;
$function$;

-- 4. Realtime: restrict broadcast/subscribe to super_admin only
--    (the only client subscription is super_admin presence monitoring)
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;

CREATE POLICY "Only super_admin can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Only super_admin can broadcast realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
