-- Función para inactivar un usuario (admin/super_admin)
-- Marca activo=false en usuarios_congregacion y banea en auth.users
CREATE OR REPLACE FUNCTION public.inactivar_usuario(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo admins/super_admin pueden ejecutar esto
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    ) OR
    EXISTS (
      SELECT 1 FROM public.usuarios_congregacion
      WHERE user_id = auth.uid() AND rol IN ('admin', 'super_admin') AND activo = true
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Marcar inactivo en todas las congregaciones
  UPDATE public.usuarios_congregacion
  SET activo = false
  WHERE user_id = p_user_id;

  -- Banear en auth (impide login y reset de clave)
  UPDATE auth.users
  SET banned_until = '2099-12-31T23:59:59Z'
  WHERE id = p_user_id;
END;
$$;

-- Función para reactivar un usuario
CREATE OR REPLACE FUNCTION public.activar_usuario(p_user_id uuid, p_congregacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo admins/super_admin pueden ejecutar esto
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    ) OR
    EXISTS (
      SELECT 1 FROM public.usuarios_congregacion
      WHERE user_id = auth.uid() AND rol IN ('admin', 'super_admin') AND activo = true
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Reactivar en la congregación indicada
  UPDATE public.usuarios_congregacion
  SET activo = true
  WHERE user_id = p_user_id AND congregacion_id = p_congregacion_id;

  -- Quitar ban en auth
  UPDATE auth.users
  SET banned_until = NULL
  WHERE id = p_user_id;
END;
$$;
