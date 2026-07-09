-- Fix 1: Profiles table - restrict access to own profile + admins
DROP POLICY IF EXISTS "Admin y Editor pueden ver todos los perfiles" ON public.profiles;

-- Only admins can see all profiles (not editors, to prevent data harvesting)
CREATE POLICY "Solo admin puede ver todos los perfiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR auth.uid() = id
);

-- Fix 2: Participantes table - restrict phone visibility
-- Remove the open policy that allows any authenticated user to see all data
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver participantes" ON public.participantes;

-- Only admin and editor can see full participant data (including phone)
CREATE POLICY "Admin y Editor pueden ver todos los participantes" 
ON public.participantes 
FOR SELECT 
USING (is_admin_or_editor(auth.uid()));

-- Regular users can see basic participant info but must use get_participantes_seguros function
-- which masks the phone number. Grant execute on the function.
GRANT EXECUTE ON FUNCTION public.get_participantes_seguros() TO authenticated;