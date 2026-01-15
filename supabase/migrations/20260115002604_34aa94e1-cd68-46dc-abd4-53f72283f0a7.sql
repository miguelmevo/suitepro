-- Actualizar política de historial_sesiones para que super_admin pueda ver todo
DROP POLICY IF EXISTS "Admins can view session history" ON historial_sesiones;

CREATE POLICY "Super admin can view all session history" 
ON historial_sesiones 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Actualizar política de user_presence para que super_admin pueda ver todo
DROP POLICY IF EXISTS "Admins can view presence" ON user_presence;

CREATE POLICY "Super admin can view all presence" 
ON user_presence 
FOR SELECT 
USING (is_super_admin(auth.uid()));