-- Eliminar política anterior que permite a todos ver congregaciones activas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver congregaciones activas" ON public.congregaciones;