-- Eliminar políticas existentes de SELECT en congregaciones
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver congregaciones" ON public.congregaciones;

-- Crear política restrictiva: solo usuarios con membresía activa pueden ver congregaciones
CREATE POLICY "Usuarios pueden ver sus congregaciones"
ON public.congregaciones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios_congregacion 
    WHERE usuarios_congregacion.congregacion_id = congregaciones.id 
      AND usuarios_congregacion.user_id = auth.uid() 
      AND usuarios_congregacion.activo = true
  )
);

-- Política adicional para que admins globales puedan ver todas (si tienen rol admin en user_roles)
CREATE POLICY "Admins globales pueden ver todas las congregaciones"
ON public.congregaciones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
  )
);