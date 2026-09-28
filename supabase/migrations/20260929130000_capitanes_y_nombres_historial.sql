-- El selector de capitán (Historial de territorios) y los nombres "comenzado
-- por"/"terminado por"/"eliminado por" consultaban participantes/profiles
-- directo. Desde que se blindó participantes (20260621152222), quien solo
-- tiene el permiso granular de Historial de territorios (sin
-- configuracion_participantes) ya no ve a los demás ahí: se veía únicamente a
-- sí mismo. Estas dos funciones (SECURITY DEFINER) resuelven eso para quien
-- puede ver/crear/editar el historial, o es admin.

CREATE OR REPLACE FUNCTION public.puede_ver_historial_territorios(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin_in_congregacion(_congregacion_id)
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'ver')
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'crear')
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'editar');
$$;

-- Capitanes de grupo para el selector "quién trabajó las manzanas": activos,
-- con cuenta activa, sin el super admin. Mismas reglas que ya se aplicaban en
-- la consulta directa, ahora sin depender de qué le deja ver RLS al usuario.
CREATE OR REPLACE FUNCTION public.obtener_capitanes_para_historial(_congregacion_id uuid)
RETURNS TABLE (user_id uuid, nombre text, apellido text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.puede_ver_historial_territorios(_congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.nombre, p.apellido
  FROM public.participantes p
  JOIN public.usuarios_congregacion uc ON uc.user_id = p.user_id AND uc.congregacion_id = p.congregacion_id
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.congregacion_id = _congregacion_id
    AND p.activo = true
    AND p.es_capitan_grupo = true
    AND p.user_id IS NOT NULL
    AND uc.activo = true
    AND lower(coalesce(pr.email, '')) <> 'miguelmevo@gmail.com'
  ORDER BY p.nombre;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.obtener_capitanes_para_historial(uuid) TO authenticated;

-- Nombres de un conjunto de usuarios (quién registró/terminó/eliminó algo),
-- para quien puede ver el historial. Primero busca en participantes y, si
-- falta, en profiles (quien registró puede ser un admin sin ficha de
-- participante).
CREATE OR REPLACE FUNCTION public.obtener_nombres_para_historial(_congregacion_id uuid, _user_ids uuid[])
RETURNS TABLE (user_id uuid, nombre_completo text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.puede_ver_historial_territorios(_congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT u.id,
         COALESCE(
           (SELECT trim(p.nombre || ' ' || p.apellido) FROM public.participantes p
            WHERE p.user_id = u.id AND p.congregacion_id = _congregacion_id LIMIT 1),
           (SELECT trim(coalesce(pr.nombre, '') || ' ' || coalesce(pr.apellido, '')) FROM public.profiles pr WHERE pr.id = u.id)
         )
  FROM unnest(_user_ids) AS u(id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.obtener_nombres_para_historial(uuid, uuid[]) TO authenticated;
