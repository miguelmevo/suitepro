
-- Actualizar is_congregation_admin para incluir super_admin
CREATE OR REPLACE FUNCTION public.is_congregation_admin(_congregacion_id uuid)
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
      AND rol IN ('admin', 'super_admin')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
$$;

-- Actualizar is_admin_or_editor_in_congregacion para incluir super_admin
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
      AND rol IN ('admin', 'editor', 'super_admin')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
$$;
