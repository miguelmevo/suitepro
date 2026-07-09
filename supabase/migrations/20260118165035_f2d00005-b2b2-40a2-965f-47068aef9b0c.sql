-- Actualizar política de UPDATE para congregaciones
-- Permitir que super_admins también puedan actualizar
DROP POLICY IF EXISTS "Admin de congregación puede actualizar su congregación" ON congregaciones;

CREATE POLICY "Admin de congregación puede actualizar su congregación"
ON congregaciones
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = congregaciones.id
      AND uc.rol = 'admin'::app_role
      AND uc.activo = true
  )
  OR is_super_admin(auth.uid())
);