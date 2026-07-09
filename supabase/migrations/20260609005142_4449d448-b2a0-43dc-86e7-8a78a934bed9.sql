DROP POLICY IF EXISTS "Admin y Editor pueden crear participantes en su congregación" ON public.participantes;
CREATE POLICY "Usuarios autorizados pueden crear participantes en su congregación"
ON public.participantes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), congregacion_id, 'configuracion_participantes', 'crear')
);

DROP POLICY IF EXISTS "Usuarios pueden actualizar su participante o admin/editor todos" ON public.participantes;
CREATE POLICY "Usuarios autorizados pueden actualizar participantes"
ON public.participantes
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_participantes', 'editar')
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_participantes', 'editar')
);

DROP POLICY IF EXISTS "Admin y Editor pueden eliminar participantes de su congregació" ON public.participantes;
CREATE POLICY "Usuarios autorizados pueden eliminar participantes"
ON public.participantes
FOR DELETE
TO authenticated
USING (
  public.has_permission(auth.uid(), congregacion_id, 'configuracion_participantes', 'eliminar')
);