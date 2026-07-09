-- Agregar política para que admins de congregación puedan eliminar perfiles (rechazar usuarios)
CREATE POLICY "Congregation admins can delete member profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM usuarios_congregacion uc_admin
    INNER JOIN usuarios_congregacion uc_member ON uc_admin.congregacion_id = uc_member.congregacion_id
    WHERE uc_admin.user_id = auth.uid()
      AND uc_member.user_id = profiles.id
      AND uc_admin.rol IN ('admin', 'super_admin')
      AND uc_admin.activo = true
      AND uc_member.activo = true
  )
  OR is_super_admin(auth.uid())
);