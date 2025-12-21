-- Crear tabla para disponibilidad específica de capitanes
CREATE TABLE public.disponibilidad_capitanes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capitan_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  bloque_horario TEXT NOT NULL CHECK (bloque_horario IN ('manana', 'tarde', 'ambos')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Evitar duplicados: un capitán solo puede tener una entrada por día
  UNIQUE (capitan_id, dia_semana)
);

-- Comentarios descriptivos
COMMENT ON TABLE public.disponibilidad_capitanes IS 'Define la disponibilidad específica de cada capitán por día y bloque horario';
COMMENT ON COLUMN public.disponibilidad_capitanes.dia_semana IS '0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado';
COMMENT ON COLUMN public.disponibilidad_capitanes.bloque_horario IS 'manana=solo mañana, tarde=solo tarde, ambos=mañana y tarde';

-- Habilitar RLS
ALTER TABLE public.disponibilidad_capitanes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios autenticados pueden ver disponibilidad_capitanes"
ON public.disponibilidad_capitanes
FOR SELECT
USING (true);

CREATE POLICY "Admin y Editor pueden crear disponibilidad_capitanes"
ON public.disponibilidad_capitanes
FOR INSERT
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar disponibilidad_capitanes"
ON public.disponibilidad_capitanes
FOR UPDATE
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar disponibilidad_capitanes"
ON public.disponibilidad_capitanes
FOR DELETE
USING (is_admin_or_editor(auth.uid()));

-- Índice para búsquedas frecuentes
CREATE INDEX idx_disponibilidad_capitanes_capitan ON public.disponibilidad_capitanes(capitan_id) WHERE activo = true;