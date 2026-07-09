-- 1. PROFILES TABLE: Remove overlapping and insecure policies
DROP POLICY IF EXISTS "Admin puede actualizar cualquier perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admin puede ver todos los perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Sistema puede crear perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Congregation admins can delete member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Congregation admins can update member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Congregation admins can view member profiles" ON public.profiles;

-- Create clean, consolidated policies for profiles
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Congregation admins can view member profiles in their congregation
CREATE POLICY "Congregation admins can view member profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM usuarios_congregacion uc_admin
    JOIN usuarios_congregacion uc_member ON uc_admin.congregacion_id = uc_member.congregacion_id
    WHERE uc_admin.user_id = auth.uid()
      AND uc_member.user_id = profiles.id
      AND uc_admin.rol IN ('admin', 'super_admin')
      AND uc_admin.activo = true
      AND uc_member.activo = true
  )
  OR is_super_admin(auth.uid())
);

-- Congregation admins can update member profiles
CREATE POLICY "Congregation admins can update member profiles"
ON public.profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM usuarios_congregacion uc_admin
    JOIN usuarios_congregacion uc_member ON uc_admin.congregacion_id = uc_member.congregacion_id
    WHERE uc_admin.user_id = auth.uid()
      AND uc_member.user_id = profiles.id
      AND uc_admin.rol IN ('admin', 'super_admin')
      AND uc_admin.activo = true
      AND uc_member.activo = true
  )
  OR is_super_admin(auth.uid())
);

-- Congregation admins can delete member profiles
CREATE POLICY "Congregation admins can delete member profiles"
ON public.profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM usuarios_congregacion uc_admin
    JOIN usuarios_congregacion uc_member ON uc_admin.congregacion_id = uc_member.congregacion_id
    WHERE uc_admin.user_id = auth.uid()
      AND uc_member.user_id = profiles.id
      AND uc_admin.rol IN ('admin', 'super_admin')
      AND uc_admin.activo = true
      AND uc_member.activo = true
  )
  OR is_super_admin(auth.uid())
);

-- 2. DIRECCIONES_BLOQUEADAS: Remove public read policy
DROP POLICY IF EXISTS "Lectura pública de direcciones_bloqueadas" ON public.direcciones_bloqueadas;