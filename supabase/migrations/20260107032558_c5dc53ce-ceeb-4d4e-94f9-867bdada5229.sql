-- Asignar rol super_admin a miguelmevo@gmail.com en user_roles (para acceso global)
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'super_admin'::app_role
FROM public.profiles p
WHERE p.email = 'miguelmevo@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Crear función para verificar si es super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Actualizar política de congregaciones para que super_admin pueda ver todas
DROP POLICY IF EXISTS "Admins globales pueden ver todas las congregaciones" ON public.congregaciones;

CREATE POLICY "Super admins pueden ver todas las congregaciones" 
ON public.congregaciones 
FOR SELECT 
TO authenticated
USING (is_super_admin(auth.uid()));