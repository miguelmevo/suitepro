DROP POLICY IF EXISTS "Usuarios con permiso pueden crear horarios en su congregación" ON public.horarios_salida;
DROP POLICY IF EXISTS "Usuarios con permiso pueden actualizar horarios en su congregación" ON public.horarios_salida;
DROP POLICY IF EXISTS "Usuarios con permiso pueden eliminar horarios en su congregación" ON public.horarios_salida;

CREATE POLICY "Usuarios con permiso pueden crear horarios en su congregación"
ON public.horarios_salida
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), congregacion_id, 'ajustes_predicacion', 'crear')
);

CREATE POLICY "Usuarios con permiso pueden actualizar horarios en su congregación"
ON public.horarios_salida
FOR UPDATE
TO authenticated
USING (
  public.has_permission(auth.uid(), congregacion_id, 'ajustes_predicacion', 'editar')
)
WITH CHECK (
  public.has_permission(auth.uid(), congregacion_id, 'ajustes_predicacion', 'editar')
);

CREATE POLICY "Usuarios con permiso pueden eliminar horarios en su congregación"
ON public.horarios_salida
FOR DELETE
TO authenticated
USING (
  public.has_permission(auth.uid(), congregacion_id, 'ajustes_predicacion', 'eliminar')
);