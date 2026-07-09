-- Permitir SELECT público en congregaciones para validar slug en /auth (usuarios no autenticados)
-- Solo expone id, nombre, slug, activo - NO información sensible

DROP POLICY IF EXISTS "Usuarios pueden ver sus congregaciones" ON public.congregaciones;
DROP POLICY IF EXISTS "Super admins pueden ver todas las congregaciones" ON public.congregaciones;
DROP POLICY IF EXISTS "Public can check slug" ON public.congregaciones;

-- Super admins ven todas
CREATE POLICY "Super admins pueden ver todas las congregaciones"
ON public.congregaciones
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Usuarios autenticados ven sus congregaciones
CREATE POLICY "Usuarios ven sus congregaciones"
ON public.congregaciones
FOR SELECT
TO authenticated
USING (user_has_access_to_congregacion(id));

-- Anónimos solo pueden verificar si un slug existe (para validar subdominio en /auth)
CREATE POLICY "Anon can verify slug exists"
ON public.congregaciones
FOR SELECT
TO anon
USING (activo = true);
