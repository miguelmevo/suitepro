-- Función para verificar si un usuario puede crear congregaciones
-- Solo permite: admins globales O usuarios sin membresía en ninguna congregación (nuevos)
CREATE OR REPLACE FUNCTION public.can_create_congregation()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Es admin global
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    -- O no tiene membresía en ninguna congregación (usuario nuevo durante registro)
    NOT EXISTS (
      SELECT 1 FROM public.usuarios_congregacion 
      WHERE user_id = auth.uid() AND activo = true
    )
$$;

-- Eliminar la política permisiva actual
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear congregaciones" ON public.congregaciones;

-- Crear nueva política restrictiva
CREATE POLICY "Solo usuarios nuevos o admins pueden crear congregaciones" 
ON public.congregaciones 
FOR INSERT 
TO authenticated
WITH CHECK (can_create_congregation());