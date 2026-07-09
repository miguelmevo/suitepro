
-- Crear función para obtener usuarios completamente huérfanos (incluyendo los que no tienen perfil)
CREATE OR REPLACE FUNCTION public.get_orphan_users()
 RETURNS TABLE(id uuid, email text, nombre text, apellido text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Solo super_admin puede ejecutar esta función
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.nombre,
    p.apellido,
    p.created_at
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = p.id AND uc.activo = true
  )
  ORDER BY p.created_at DESC;
END;
$function$;

-- Actualizar delete_orphan_user para que no requiera que exista en profiles
CREATE OR REPLACE FUNCTION public.delete_orphan_user(_user_id uuid, _caller_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  effective_caller uuid;
BEGIN
  -- Determinar el caller: usar _caller_id si se proporciona, sino auth.uid()
  effective_caller := COALESCE(_caller_id, auth.uid());
  
  -- Verificar que el caller sea super_admin
  IF NOT is_super_admin(effective_caller) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Verificar que el usuario realmente sea huérfano (sin membresía activa)
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
  
  -- Eliminar el perfil si existe
  DELETE FROM public.profiles WHERE id = _user_id;
  
  -- Nota: La eliminación de auth.users se hace en la edge function
END;
$function$;
