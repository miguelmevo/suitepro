
-- Agregar campo de aprobación a profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS aprobado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_aprobacion timestamp with time zone,
ADD COLUMN IF NOT EXISTS aprobado_por uuid REFERENCES auth.users(id);

-- Modificar el trigger para NO asignar rol automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, apellido, aprobado)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'nombre',
    NEW.raw_user_meta_data ->> 'apellido',
    false  -- Usuario NO aprobado por defecto
  );
  
  -- NO asignar rol automáticamente, el admin lo hará manualmente
  -- INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Actualizar políticas RLS de profiles para que admins puedan ver todos los perfiles pendientes
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Los usuarios pueden actualizar su propio perfil (solo nombre y apellido)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Los admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- Los admins pueden actualizar cualquier perfil (para aprobar)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));
