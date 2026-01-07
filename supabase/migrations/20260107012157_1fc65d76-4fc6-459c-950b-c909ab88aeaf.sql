
-- Primero, eliminar las políticas problemáticas
DROP POLICY IF EXISTS "Admin puede ver todas las membresías de su congregación" ON usuarios_congregacion;
DROP POLICY IF EXISTS "Admin puede crear membresías en su congregación" ON usuarios_congregacion;
DROP POLICY IF EXISTS "Admin puede actualizar membresías en su congregación" ON usuarios_congregacion;
DROP POLICY IF EXISTS "Admin puede eliminar membresías en su congregación" ON usuarios_congregacion;

-- Crear función SECURITY DEFINER para verificar si es admin de una congregación (sin causar recursión)
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
      AND rol = 'admin'
      AND activo = true
  )
$$;

-- Recrear políticas usando la función SECURITY DEFINER
CREATE POLICY "Admin puede ver membresías de su congregación"
ON usuarios_congregacion FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_congregation_admin(congregacion_id)
);

CREATE POLICY "Admin puede crear membresías"
ON usuarios_congregacion FOR INSERT
WITH CHECK (
  is_congregation_admin(congregacion_id)
);

CREATE POLICY "Admin puede actualizar membresías"
ON usuarios_congregacion FOR UPDATE
USING (is_congregation_admin(congregacion_id));

CREATE POLICY "Admin puede eliminar membresías"
ON usuarios_congregacion FOR DELETE
USING (is_congregation_admin(congregacion_id));

-- Eliminar la política duplicada de SELECT (ya está incluida en la nueva)
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias membresías" ON usuarios_congregacion;
