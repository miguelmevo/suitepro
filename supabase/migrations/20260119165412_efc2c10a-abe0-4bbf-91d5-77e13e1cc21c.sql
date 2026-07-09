
-- Fix user_has_access_to_congregacion to include super_admin check
-- This allows super_admin to access ALL congregations

CREATE OR REPLACE FUNCTION public.user_has_access_to_congregacion(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion 
    WHERE user_id = auth.uid() 
      AND congregacion_id = _congregacion_id 
      AND activo = true
  )
  OR is_super_admin(auth.uid())  -- Add super_admin global access
$$;
