
-- Modificar delete_orphan_user para aceptar un parámetro opcional de caller_id
-- Esto permite que la edge function pase el ID del usuario que está haciendo la llamada
CREATE OR REPLACE FUNCTION public.delete_orphan_user(_user_id uuid, _caller_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_caller uuid;
BEGIN
  -- Determinar el caller: usar _caller_id si se proporciona, sino auth.uid()
  effective_caller := COALESCE(_caller_id, auth.uid());
  
  -- Verificar que el caller sea super_admin
  IF NOT is_super_admin(effective_caller) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Verificar que el usuario realmente sea huérfano
  IF EXISTS (
    SELECT 1 FROM public.usuarios_congregacion 
    WHERE user_id = _user_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'user_not_orphan';
  END IF;

  -- Eliminar de user_roles si existe
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Eliminar membresías inactivas si existen
  DELETE FROM public.usuarios_congregacion WHERE user_id = _user_id;
  
  -- Eliminar el perfil
  DELETE FROM public.profiles WHERE id = _user_id;
END;
$$;
