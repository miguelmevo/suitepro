-- Las políticas RLS de permisos_usuario_congregacion (insertar/actualizar/
-- eliminar) solo revisaban el rol legado (admin/super_admin en
-- usuarios_congregacion), ignorando el sistema de permisos granulares.
-- Un usuario con permisos granulares "acceso total" en configuracion_usuarios
-- pero rol legado 'user' podía ver y usar la pantalla de Usuarios y Permisos
-- en la app, pero la base de datos rechazaba el guardado ("new row violates
-- row-level security policy"). Se actualizan las políticas para también
-- aceptar has_permission(..., 'configuracion_usuarios', <accion>).

DROP POLICY IF EXISTS "Admins ven permisos de su congregación" ON public.permisos_usuario_congregacion;
CREATE POLICY "Admins ven permisos de su congregación"
ON public.permisos_usuario_congregacion
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = permisos_usuario_congregacion.congregacion_id
      AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
      AND uc.activo = true
  )
  OR public.has_permission(auth.uid(), permisos_usuario_congregacion.congregacion_id, 'configuracion_usuarios', 'ver')
);

DROP POLICY IF EXISTS "Admins crean permisos en su congregación" ON public.permisos_usuario_congregacion;
CREATE POLICY "Admins crean permisos en su congregación"
ON public.permisos_usuario_congregacion
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = permisos_usuario_congregacion.congregacion_id
      AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
      AND uc.activo = true
  )
  OR public.has_permission(auth.uid(), permisos_usuario_congregacion.congregacion_id, 'configuracion_usuarios', 'crear')
);

DROP POLICY IF EXISTS "Admins actualizan permisos en su congregación" ON public.permisos_usuario_congregacion;
CREATE POLICY "Admins actualizan permisos en su congregación"
ON public.permisos_usuario_congregacion
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = permisos_usuario_congregacion.congregacion_id
      AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
      AND uc.activo = true
  )
  OR public.has_permission(auth.uid(), permisos_usuario_congregacion.congregacion_id, 'configuracion_usuarios', 'editar')
);

DROP POLICY IF EXISTS "Admins eliminan permisos en su congregación" ON public.permisos_usuario_congregacion;
CREATE POLICY "Admins eliminan permisos en su congregación"
ON public.permisos_usuario_congregacion
FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = permisos_usuario_congregacion.congregacion_id
      AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
      AND uc.activo = true
  )
  OR public.has_permission(auth.uid(), permisos_usuario_congregacion.congregacion_id, 'configuracion_usuarios', 'eliminar')
);
