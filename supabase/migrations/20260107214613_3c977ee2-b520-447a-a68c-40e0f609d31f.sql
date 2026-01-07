-- Actualizar la función create_congregation_and_admin para también crear la configuración del nombre
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

  -- Crear configuración del nombre de la congregación
  INSERT INTO public.configuracion_sistema (programa_tipo, clave, valor, congregacion_id)
  VALUES ('general', 'nombre_congregacion', jsonb_build_object('nombre', _nombre), new_id)
  ON CONFLICT (programa_tipo, clave, congregacion_id) DO UPDATE
  SET valor = jsonb_build_object('nombre', _nombre), updated_at = now();

  -- Auto-aprobar al creador (requiere que ya sea admin de esa congregación)
  PERFORM public.approve_congregation_creator(new_id);

  id := new_id;
  slug := new_slug;
  RETURN NEXT;
END;
$$;