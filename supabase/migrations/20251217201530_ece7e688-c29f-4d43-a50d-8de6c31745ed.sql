-- Agregar campo responsabilidad_adicional a participantes
ALTER TABLE public.participantes 
ADD COLUMN responsabilidad_adicional text DEFAULT NULL;

-- Agregar comentario para documentar los valores válidos
COMMENT ON COLUMN public.participantes.responsabilidad_adicional IS 'Valores: superintendente_grupo, auxiliar_grupo, o NULL si no aplica';