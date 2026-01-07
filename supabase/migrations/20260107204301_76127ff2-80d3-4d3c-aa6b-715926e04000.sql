-- Primero eliminar la política que depende de la función
DROP POLICY IF EXISTS "Solo usuarios nuevos o admins pueden crear congregaciones" ON public.congregaciones;

-- Ahora recrear la función corregida
CREATE OR REPLACE FUNCTION public.can_create_congregation()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Es super_admin global
    is_super_admin(auth.uid())
    OR
    -- O es un usuario autenticado sin membresía en ninguna congregación activa
    (
      auth.uid() IS NOT NULL 
      AND NOT EXISTS (
        SELECT 1 FROM public.usuarios_congregacion 
        WHERE user_id = auth.uid() AND activo = true
      )
    )
$$;

-- Recrear la política con la función corregida
CREATE POLICY "Solo usuarios nuevos o admins pueden crear congregaciones" 
ON public.congregaciones 
FOR INSERT 
TO authenticated
WITH CHECK (can_create_congregation());