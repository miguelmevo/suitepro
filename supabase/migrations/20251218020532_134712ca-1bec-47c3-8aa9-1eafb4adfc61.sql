-- Agregar columna para múltiples territorios
ALTER TABLE public.programa_predicacion 
ADD COLUMN territorio_ids uuid[] DEFAULT '{}';

-- Migrar datos existentes: copiar territorio_id a territorio_ids si existe
UPDATE public.programa_predicacion 
SET territorio_ids = ARRAY[territorio_id]
WHERE territorio_id IS NOT NULL;