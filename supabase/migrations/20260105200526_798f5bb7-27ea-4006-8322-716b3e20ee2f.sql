-- Agregar constraint único para nombre de congregación (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS congregaciones_nombre_unique_idx 
ON public.congregaciones (LOWER(nombre));

-- También asegurar que el slug sea único
CREATE UNIQUE INDEX IF NOT EXISTS congregaciones_slug_unique_idx 
ON public.congregaciones (slug);