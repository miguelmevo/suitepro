-- Fix asignaciones_capitan_fijas: drop constraint then create new index with congregacion_id
ALTER TABLE public.asignaciones_capitan_fijas 
DROP CONSTRAINT IF EXISTS asignaciones_capitan_fijas_dia_semana_horario_id_key;

CREATE UNIQUE INDEX asignaciones_capitan_fijas_dia_horario_congregacion_key 
ON public.asignaciones_capitan_fijas (dia_semana, horario_id, congregacion_id);

-- Fix grupos_predicacion: drop constraint then create new index with congregacion_id
ALTER TABLE public.grupos_predicacion 
DROP CONSTRAINT IF EXISTS grupos_predicacion_numero_key;

CREATE UNIQUE INDEX grupos_predicacion_numero_congregacion_key 
ON public.grupos_predicacion (numero, congregacion_id) 
WHERE (activo = true);