ALTER TABLE public.mensajes_adicionales
ADD COLUMN IF NOT EXISTS modulo TEXT NOT NULL DEFAULT 'predicacion';

ALTER TABLE public.mensajes_adicionales
DROP CONSTRAINT IF EXISTS mensajes_adicionales_modulo_check;

ALTER TABLE public.mensajes_adicionales
ADD CONSTRAINT mensajes_adicionales_modulo_check
CHECK (modulo IN ('predicacion','asignaciones_servicio','ambos'));