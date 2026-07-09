-- Permitir que usuarios autenticados recién registrados puedan crear congregaciones
-- La política de INSERT será permisiva para usuarios autenticados (recién registrados incluidos)

-- Primero eliminar cualquier política de INSERT existente
DROP POLICY IF EXISTS "Admins pueden insertar congregaciones" ON public.congregaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear congregaciones" ON public.congregaciones;

-- Crear política que permite a cualquier usuario autenticado crear una congregación
CREATE POLICY "Usuarios autenticados pueden crear congregaciones"
ON public.congregaciones
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Nota: El trigger assign_congregation_admin ya existe y asignará automáticamente 
-- al creador como admin de la congregación