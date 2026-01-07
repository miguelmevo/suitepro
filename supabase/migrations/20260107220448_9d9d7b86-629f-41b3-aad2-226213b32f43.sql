-- Permitir que el super_admin principal recupere su acceso si su perfil/membresía fueron eliminados
CREATE OR REPLACE FUNCTION public.restore_super_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_claim text;
  villa_real_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  email_claim := lower(COALESCE(current_setting('request.jwt.claim.email', true), ''));

  -- Solo el dueño del email autorizado puede ejecutar esta restauración
  IF email_claim <> 'miguelmevo@gmail.com' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Asegurar perfil (aprobado)
  INSERT INTO public.profiles (id, email, aprobado, fecha_aprobacion)
  VALUES (auth.uid(), email_claim, true, now())
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    aprobado = true,
    fecha_aprobacion = COALESCE(public.profiles.fecha_aprobacion, now()),
    updated_at = now();

  -- Asegurar rol global super_admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Asegurar membresía en Villa Real como super_admin
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = villa_real_id
  ) THEN
    INSERT INTO public.usuarios_congregacion (user_id, congregacion_id, rol, es_principal, activo)
    VALUES (auth.uid(), villa_real_id, 'super_admin', true, true);
  ELSE
    UPDATE public.usuarios_congregacion
    SET rol = 'super_admin', activo = true
    WHERE user_id = auth.uid()
      AND congregacion_id = villa_real_id;
  END IF;
END;
$$;