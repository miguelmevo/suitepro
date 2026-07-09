-- Tabla para asignaciones fijas de capitán (día + horario)
CREATE TABLE public.asignaciones_capitan_fijas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6), -- 0=Domingo, 6=Sábado
  horario_id UUID NOT NULL REFERENCES public.horarios_salida(id) ON DELETE CASCADE,
  capitan_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dia_semana, horario_id) -- Solo un capitán fijo por combinación día+horario
);

-- Habilitar RLS
ALTER TABLE public.asignaciones_capitan_fijas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios autenticados pueden ver asignaciones_capitan_fijas"
ON public.asignaciones_capitan_fijas
FOR SELECT
USING (true);

CREATE POLICY "Admin y Editor pueden crear asignaciones_capitan_fijas"
ON public.asignaciones_capitan_fijas
FOR INSERT
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar asignaciones_capitan_fijas"
ON public.asignaciones_capitan_fijas
FOR UPDATE
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar asignaciones_capitan_fijas"
ON public.asignaciones_capitan_fijas
FOR DELETE
USING (is_admin_or_editor(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_asignaciones_capitan_fijas_updated_at
BEFORE UPDATE ON public.asignaciones_capitan_fijas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();