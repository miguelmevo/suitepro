-- Remove public read policy from manzanas_territorio
DROP POLICY IF EXISTS "Lectura pública de manzanas_territorio" ON public.manzanas_territorio;