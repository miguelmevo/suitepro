-- Eliminar la política de lectura pública que expone los territorios a usuarios no autenticados
DROP POLICY IF EXISTS "Lectura pública de territorios" ON public.territorios;