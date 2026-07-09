-- Add fields for group-based territory assignments
ALTER TABLE public.programa_predicacion
ADD COLUMN es_por_grupos boolean NOT NULL DEFAULT false,
ADD COLUMN asignaciones_grupos jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.programa_predicacion.es_por_grupos IS 'When true, entry displays territory assignments per preaching group';
COMMENT ON COLUMN public.programa_predicacion.asignaciones_grupos IS 'Array of {grupo_id, territorio_id} for group-based assignments';