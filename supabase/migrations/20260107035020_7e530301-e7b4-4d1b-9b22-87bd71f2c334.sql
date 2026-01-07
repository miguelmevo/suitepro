-- Permitir que usuarios puedan crear su propia membresía durante registro
-- (solo su propio user_id, rol 'user', y activo true)

DROP POLICY IF EXISTS "Admin puede crear membresías" ON public.usuarios_congregacion;

-- Admins pueden crear cualquier membresía en su congregación
CREATE POLICY "Admin puede crear membresías"
ON public.usuarios_congregacion
FOR INSERT
TO authenticated
WITH CHECK (
  is_congregation_admin(congregacion_id)
);

-- Usuarios pueden crear su propia membresía (auto-registro)
CREATE POLICY "Usuario puede auto-registrarse en congregación"
ON public.usuarios_congregacion
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND rol = 'user'
  AND activo = true
);
