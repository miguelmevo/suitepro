-- Auto-aprobación del creador de congregación (evita quedar en PendingApproval)

CREATE OR REPLACE FUNCTION public.approve_congregation_creator(_congregacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Solo el usuario que quedó como admin de ESA congregación puede auto-aprobarse
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = _congregacion_id
      AND uc.rol = 'admin'
      AND uc.activo = true
  ) THEN
    RAISE EXCEPTION 'not_congregation_admin';
  END IF;

  -- Upsert del profile (si no existe todavía, se crea). Email desde el JWT.
  INSERT INTO public.profiles (id, email, aprobado, fecha_aprobacion)
  VALUES (
    auth.uid(),
    COALESCE(current_setting('request.jwt.claim.email', true), ''),
    true,
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    aprobado = true,
    fecha_aprobacion = now(),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_congregation_creator(uuid) TO authenticated;
