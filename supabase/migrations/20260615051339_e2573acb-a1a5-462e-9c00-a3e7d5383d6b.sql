
CREATE TABLE public.tipos_salida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregacion_id uuid NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  forma text NOT NULL DEFAULT 'grupo',
  color text NOT NULL DEFAULT '#3b82f6',
  icono text,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (congregacion_id, nombre)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_salida TO authenticated;
GRANT ALL ON public.tipos_salida TO service_role;

ALTER TABLE public.tipos_salida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver tipos_salida de su congregacion"
  ON public.tipos_salida FOR SELECT
  USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Crear tipos_salida con permiso"
  ON public.tipos_salida FOR INSERT
  WITH CHECK (has_permission(auth.uid(), congregacion_id, 'predicacion_puntos', 'crear'));

CREATE POLICY "Editar tipos_salida con permiso"
  ON public.tipos_salida FOR UPDATE
  USING (has_permission(auth.uid(), congregacion_id, 'predicacion_puntos', 'editar'))
  WITH CHECK (has_permission(auth.uid(), congregacion_id, 'predicacion_puntos', 'editar'));

CREATE POLICY "Eliminar tipos_salida con permiso"
  ON public.tipos_salida FOR DELETE
  USING (has_permission(auth.uid(), congregacion_id, 'predicacion_puntos', 'eliminar'));

CREATE TRIGGER trg_tipos_salida_updated_at
  BEFORE UPDATE ON public.tipos_salida
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tipos_salida_congregacion ON public.tipos_salida(congregacion_id) WHERE activo = true;
