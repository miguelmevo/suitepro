-- Crear RPC robusta para crear congregación + asignar admin + auto-aprobar
CREATE OR REPLACE FUNCTION public.create_congregation_and_admin(
  _nombre text,
  _slug text,
  _url_oculta boolean DEFAULT false
)
RETURNS TABLE(id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  new_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.can_create_congregation() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  INSERT INTO public.congregaciones (nombre, slug, activo, url_oculta)
  VALUES (_nombre, _slug, true, COALESCE(_url_oculta, false))
  RETURNING public.congregaciones.id, public.congregaciones.slug
  INTO new_id, new_slug;

  -- Asegurar membresía admin (evitar duplicados si existiera)
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = new_id
  ) THEN
    INSERT INTO public.usuarios_congregacion (user_id, congregacion_id, rol, es_principal, activo)
    VALUES (auth.uid(), new_id, 'admin', true, true);
  END IF;

  -- Auto-aprobar al creador (requiere que ya sea admin de esa congregación)
  PERFORM public.approve_congregation_creator(new_id);

  id := new_id;
  slug := new_slug;
  RETURN NEXT;
END;
$$;

-- Permitir ejecutar la función a usuarios autenticados (la lógica interna controla acceso)
GRANT EXECUTE ON FUNCTION public.create_congregation_and_admin(text, text, boolean) TO authenticated;