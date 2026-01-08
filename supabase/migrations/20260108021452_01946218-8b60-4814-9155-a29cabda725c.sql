
-- Eliminar el trigger que causa el error con auth.uid() NULL
DROP TRIGGER IF EXISTS on_congregation_created ON public.congregaciones;
