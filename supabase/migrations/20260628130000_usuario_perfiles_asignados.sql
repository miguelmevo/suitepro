-- ============================================================
-- Migración: tabla usuario_perfiles_asignados
-- Relación muchos-a-muchos entre usuarios y perfiles de permisos
-- Permite que un usuario tenga múltiples roles/perfiles asignados
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usuario_perfiles_asignados (
  user_id         uuid        NOT NULL,
  congregacion_id uuid        NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  perfil_id       uuid        NOT NULL REFERENCES public.perfiles_permisos(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, congregacion_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS upa_congregacion_idx ON public.usuario_perfiles_asignados(congregacion_id);
CREATE INDEX IF NOT EXISTS upa_user_idx         ON public.usuario_perfiles_asignados(user_id, congregacion_id);

ALTER TABLE public.usuario_perfiles_asignados ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros de la congregación pueden ver las asignaciones
CREATE POLICY "upa_select"
  ON public.usuario_perfiles_asignados FOR SELECT
  USING (
    congregacion_id IN (
      SELECT congregacion_id FROM public.usuarios_congregacion WHERE user_id = auth.uid()
    )
  );

-- INSERT: super_admin, admin de la congregación o usuario con permiso de editar usuarios
CREATE POLICY "upa_insert"
  ON public.usuario_perfiles_asignados FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.usuarios_congregacion
      WHERE user_id = auth.uid()
        AND congregacion_id = usuario_perfiles_asignados.congregacion_id
        AND rol = 'admin'
    )
    OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'editar')
  );

-- DELETE: super_admin, admin de la congregación o usuario con permiso de editar usuarios
CREATE POLICY "upa_delete"
  ON public.usuario_perfiles_asignados FOR DELETE
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.usuarios_congregacion
      WHERE user_id = auth.uid()
        AND congregacion_id = usuario_perfiles_asignados.congregacion_id
        AND rol = 'admin'
    )
    OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'editar')
  );
