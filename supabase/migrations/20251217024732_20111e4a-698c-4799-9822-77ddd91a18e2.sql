-- Eliminar la restricción única que impide múltiples salidas por día/horario
ALTER TABLE public.programa_predicacion 
DROP CONSTRAINT IF EXISTS programa_predicacion_fecha_horario_id_key;