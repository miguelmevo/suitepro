-- 1. Agregar columna grupo_servicio_id a territorios (FK a grupos_servicio)
ALTER TABLE public.territorios 
ADD COLUMN grupo_servicio_id uuid REFERENCES public.grupos_servicio(id) ON DELETE SET NULL;

-- 2. Crear índice para mejorar rendimiento de consultas
CREATE INDEX idx_territorios_grupo_servicio ON public.territorios(grupo_servicio_id) WHERE grupo_servicio_id IS NOT NULL;

-- 3. Eliminar la columna descripcion de territorios
ALTER TABLE public.territorios DROP COLUMN descripcion;