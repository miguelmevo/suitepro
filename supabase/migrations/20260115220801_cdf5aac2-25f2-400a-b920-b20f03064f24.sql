-- Cambiar la FK de grupo_servicio_id a grupo_predicacion_id en territorios
-- Primero eliminar la columna grupo_servicio_id
ALTER TABLE public.territorios DROP COLUMN IF EXISTS grupo_servicio_id;

-- Agregar la nueva columna grupo_predicacion_id con FK a grupos_predicacion
ALTER TABLE public.territorios 
ADD COLUMN grupo_predicacion_id uuid REFERENCES public.grupos_predicacion(id) ON DELETE SET NULL;