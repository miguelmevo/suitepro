-- Enum de tipos de asignación de servicio
DO $$ BEGIN
  CREATE TYPE public.tipo_asignacion_servicio AS ENUM (
    'audio',
    'video',
    'zoom',
    'plataforma',
    'pasillo_1',
    'pasillo_2',
    'acomodador_auditorio',
    'acomodador_entrada_1',
    'acomodador_entrada_2',
    'aseo_1',
    'aseo_2',
    'hospitalidad'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper de permisos: edición del programa de asignaciones de servicio
CREATE OR REPLACE FUNCTION public.can_edit_asignaciones_servicio(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion
    WHERE user_id = auth.uid()
      AND congregacion_id = _congregacion_id
      AND rol IN ('admin','editor','super_admin','saservicio')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
$$;

-- Tabla principal
CREATE TABLE public.programa_asignaciones_servicio (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  congregacion_id uuid NOT NULL,
  fecha date NOT NULL,
  dia_reunion text NOT NULL CHECK (dia_reunion IN ('entre_semana','fin_semana')),
  tipo_asignacion public.tipo_asignacion_servicio NOT NULL,
  participante_id uuid NULL,
  grupo_predicacion_id uuid NULL,
  notas text NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_asig_servicio UNIQUE (congregacion_id, fecha, tipo_asignacion)
);

CREATE INDEX idx_asig_servicio_congregacion_fecha ON public.programa_asignaciones_servicio (congregacion_id, fecha);
CREATE INDEX idx_asig_servicio_participante ON public.programa_asignaciones_servicio (participante_id) WHERE participante_id IS NOT NULL;
CREATE INDEX idx_asig_servicio_grupo ON public.programa_asignaciones_servicio (grupo_predicacion_id) WHERE grupo_predicacion_id IS NOT NULL;

-- RLS
ALTER TABLE public.programa_asignaciones_servicio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver asignaciones de servicio de su congregacion"
ON public.programa_asignaciones_servicio FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Saservicio/Admin/Editor pueden crear asignaciones de servicio"
ON public.programa_asignaciones_servicio FOR INSERT
WITH CHECK (can_edit_asignaciones_servicio(congregacion_id));

CREATE POLICY "Saservicio/Admin/Editor pueden actualizar asignaciones de servicio"
ON public.programa_asignaciones_servicio FOR UPDATE
USING (can_edit_asignaciones_servicio(congregacion_id));

CREATE POLICY "Saservicio/Admin/Editor pueden eliminar asignaciones de servicio"
ON public.programa_asignaciones_servicio FOR DELETE
USING (can_edit_asignaciones_servicio(congregacion_id));

-- Trigger updated_at
CREATE TRIGGER trg_asig_servicio_updated_at
BEFORE UPDATE ON public.programa_asignaciones_servicio
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();