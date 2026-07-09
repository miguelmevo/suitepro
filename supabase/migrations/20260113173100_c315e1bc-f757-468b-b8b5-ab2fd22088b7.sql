-- Tabla para registrar indisponibilidad de participantes
CREATE TABLE public.indisponibilidad_participantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  congregacion_id UUID NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE, -- NULL significa fecha única (solo fecha_inicio)
  motivo TEXT,
  tipo_responsabilidad TEXT[] NOT NULL DEFAULT ARRAY['todas']::TEXT[], -- 'todas', 'capitan', 'predicacion', 'servicio', etc.
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_indisponibilidad_participante ON public.indisponibilidad_participantes(participante_id);
CREATE INDEX idx_indisponibilidad_fechas ON public.indisponibilidad_participantes(fecha_inicio, fecha_fin);
CREATE INDEX idx_indisponibilidad_congregacion ON public.indisponibilidad_participantes(congregacion_id);

-- Habilitar RLS
ALTER TABLE public.indisponibilidad_participantes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios pueden ver indisponibilidad de su congregación"
ON public.indisponibilidad_participantes
FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear indisponibilidad en su congregación"
ON public.indisponibilidad_participantes
FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar indisponibilidad de su congregación"
ON public.indisponibilidad_participantes
FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar indisponibilidad de su congregación"
ON public.indisponibilidad_participantes
FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- Trigger para updated_at
CREATE TRIGGER update_indisponibilidad_participantes_updated_at
BEFORE UPDATE ON public.indisponibilidad_participantes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();