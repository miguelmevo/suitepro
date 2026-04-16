CREATE OR REPLACE FUNCTION public.is_admin_or_editor_in_congregacion(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion 
    WHERE user_id = auth.uid() 
      AND congregacion_id = _congregacion_id 
      AND rol IN ('admin', 'editor', 'super_admin', 'sservicio', 'srpublica')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
$$;