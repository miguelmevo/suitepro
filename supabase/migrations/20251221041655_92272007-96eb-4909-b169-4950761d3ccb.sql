-- Hacer la columna fecha nullable para días especiales (son plantillas reutilizables)
ALTER TABLE public.dias_especiales ALTER COLUMN fecha DROP NOT NULL;

-- Establecer un valor por defecto para registros existentes
UPDATE public.dias_especiales SET fecha = NULL WHERE fecha IS NOT NULL;