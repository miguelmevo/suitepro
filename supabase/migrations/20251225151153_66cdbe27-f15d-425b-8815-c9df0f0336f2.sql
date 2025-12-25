-- Eliminar las políticas de SELECT existentes en profiles
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Solo admin puede ver todos los perfiles" ON public.profiles;

-- Crear política para que usuarios solo vean su propio perfil
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Crear política para que admin pueda ver todos los perfiles
CREATE POLICY "Admin puede ver todos los perfiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));