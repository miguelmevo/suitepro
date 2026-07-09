-- Tabla de perfiles de permisos reutilizables por congregación
CREATE TABLE IF NOT EXISTS public.perfiles_permisos (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  congregacion_id uuid       NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  nombre         text        NOT NULL,
  descripcion    text,
  icono          text        NOT NULL DEFAULT 'users',
  permisos       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS perfiles_permisos_congregacion_idx ON public.perfiles_permisos(congregacion_id);

ALTER TABLE public.perfiles_permisos ENABLE ROW LEVEL SECURITY;

-- Miembros de la congregación pueden ver los perfiles
CREATE POLICY "perfiles_permisos_select"
  ON public.perfiles_permisos FOR SELECT
  USING (
    congregacion_id IN (
      SELECT congregacion_id FROM public.usuarios_congregacion WHERE user_id = auth.uid()
    )
  );

-- Solo admin/super_admin pueden insertar
CREATE POLICY "perfiles_permisos_insert"
  ON public.perfiles_permisos FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.usuarios_congregacion
      WHERE user_id = auth.uid() AND congregacion_id = perfiles_permisos.congregacion_id
      AND rol IN ('admin')
    )
    OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'crear')
  );

-- Solo admin/super_admin pueden actualizar
CREATE POLICY "perfiles_permisos_update"
  ON public.perfiles_permisos FOR UPDATE
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.usuarios_congregacion
      WHERE user_id = auth.uid() AND congregacion_id = perfiles_permisos.congregacion_id
      AND rol IN ('admin')
    )
    OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'editar')
  );

-- Solo admin/super_admin pueden eliminar
CREATE POLICY "perfiles_permisos_delete"
  ON public.perfiles_permisos FOR DELETE
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.usuarios_congregacion
      WHERE user_id = auth.uid() AND congregacion_id = perfiles_permisos.congregacion_id
      AND rol IN ('admin')
    )
    OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'eliminar')
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_perfiles_permisos()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_perfiles_permisos_updated_at ON public.perfiles_permisos;
CREATE TRIGGER trg_perfiles_permisos_updated_at
  BEFORE UPDATE ON public.perfiles_permisos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_perfiles_permisos();
