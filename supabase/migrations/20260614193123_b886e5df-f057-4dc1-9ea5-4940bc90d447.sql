DROP POLICY IF EXISTS "Admin y Editor pueden crear horarios en su congregación" ON public.horarios_salida;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar horarios de su congregación" ON public.horarios_salida;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar horarios de su congregación" ON public.horarios_salida;

CREATE POLICY "Usuarios con permiso pueden crear horarios en su congregación"
ON public.horarios_salida
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), congregacion_id, 'predicacion_programa', 'crear')
);

CREATE POLICY "Usuarios con permiso pueden actualizar horarios en su congregación"
ON public.horarios_salida
FOR UPDATE
TO authenticated
USING (
  public.has_permission(auth.uid(), congregacion_id, 'predicacion_programa', 'editar')
)
WITH CHECK (
  public.has_permission(auth.uid(), congregacion_id, 'predicacion_programa', 'editar')
);

CREATE POLICY "Usuarios con permiso pueden eliminar horarios en su congregación"
ON public.horarios_salida
FOR DELETE
TO authenticated
USING (
  public.has_permission(auth.uid(), congregacion_id, 'predicacion_programa', 'eliminar')
);