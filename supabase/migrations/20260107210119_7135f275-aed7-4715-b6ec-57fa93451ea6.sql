-- Función para obtener usuarios huérfanos (sin membresía en ninguna congregación)
-- Solo accesible para super_admin
CREATE OR REPLACE FUNCTION public.get_orphan_users()
RETURNS TABLE(
  id uuid,
  email text,
  nombre text,
  apellido text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Función para eliminar un usuario huérfano completamente
-- Solo accesible para super_admin
CREATE OR REPLACE FUNCTION public.delete_orphan_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo super_admin puede ejecutar esta función
  IF NOT is_super_admin(auth.uid()) THEN
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

GRANT EXECUTE ON FUNCTION public.get_orphan_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_orphan_user(uuid) TO authenticated;