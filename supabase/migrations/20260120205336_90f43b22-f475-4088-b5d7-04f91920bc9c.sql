-- Agregar columna para nombre de orador externo (texto libre)
ALTER TABLE public.programa_reunion_publica 
ADD COLUMN orador_nombre TEXT;