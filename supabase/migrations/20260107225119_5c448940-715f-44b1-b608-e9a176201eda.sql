
-- Agregar columna participante_id a usuarios_congregacion para vincular usuarios con participantes
ALTER TABLE public.usuarios_congregacion 
ADD COLUMN IF NOT EXISTS participante_id uuid REFERENCES public.participantes(id) ON DELETE SET NULL;

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_usuarios_congregacion_participante 
ON public.usuarios_congregacion(participante_id);
