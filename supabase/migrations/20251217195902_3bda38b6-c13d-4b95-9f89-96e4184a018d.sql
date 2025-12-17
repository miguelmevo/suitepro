-- Agregar nuevos campos a la tabla participantes
ALTER TABLE public.participantes
ADD COLUMN estado_aprobado BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN responsabilidad TEXT NOT NULL DEFAULT 'publicador',
ADD COLUMN grupo_predicacion_id UUID REFERENCES public.grupos_predicacion(id),
ADD COLUMN restriccion_disponibilidad TEXT DEFAULT 'sin_restriccion',
ADD COLUMN es_capitan_grupo BOOLEAN NOT NULL DEFAULT false;

-- Crear índice para mejorar búsquedas por grupo
CREATE INDEX idx_participantes_grupo ON public.participantes(grupo_predicacion_id);

-- Comentarios para documentar los valores posibles
COMMENT ON COLUMN public.participantes.responsabilidad IS 'Valores: publicador, siervo_ministerial, anciano';
COMMENT ON COLUMN public.participantes.restriccion_disponibilidad IS 'Valores: sin_restriccion, solo_fines_semana, solo_entre_semana';