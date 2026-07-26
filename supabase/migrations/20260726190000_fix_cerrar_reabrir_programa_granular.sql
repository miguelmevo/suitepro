-- cerrar_programa/reabrir_programa (llamadas por RPC al cerrar/reabrir el
-- candado de un programa publicado) solo revisaban el rol legado
-- (is_admin_or_editor_in_congregacion, o roles hardcodeados por tipo en
-- reabrir_programa), ignorando el permiso granular "Cerrar/reabrir" de cada
-- programa. Un usuario con ese permiso asignado explícitamente no podía
-- cerrar ni reabrir su propio programa.
CREATE OR REPLACE FUNCTION public.can_cerrar_programa(_congregacion_id uuid, _tipo_programa text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  IF public.is_admin_or_editor_in_congregacion(_congregacion_id) THEN
    RETURN true;
  END IF;

  IF _tipo_programa = 'predicacion' THEN
    RETURN public.has_permission(auth.uid(), _congregacion_id, 'cierre_predicacion', 'ver');
  END IF;

  IF _tipo_programa = 'reunion_publica' THEN
    RETURN public.has_permission(auth.uid(), _congregacion_id, 'cierre_reunion_publica', 'ver');
  END IF;

  IF _tipo_programa = 'vida_ministerio' THEN
    RETURN public.has_permission(auth.uid(), _congregacion_id, 'cierre_vym', 'ver');
  END IF;

  IF _tipo_programa = 'asignaciones_servicio' THEN
    RETURN public.has_permission(auth.uid(), _congregacion_id, 'cierre_asignaciones_servicio', 'ver');
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cerrar_programa(_programa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _congregacion_id uuid;
  _tipo text;
BEGIN
  SELECT congregacion_id, tipo_programa INTO _congregacion_id, _tipo
  FROM programas_publicados
  WHERE id = _programa_id;

  IF _congregacion_id IS NULL THEN
    RAISE EXCEPTION 'program_not_found';
  END IF;

  IF NOT public.can_cerrar_programa(_congregacion_id, _tipo) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE programas_publicados
  SET cerrado = true,
      cerrado_por = auth.uid(),
      fecha_cierre = now()
  WHERE id = _programa_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reabrir_programa(_programa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _congregacion_id uuid;
  _tipo text;
BEGIN
  SELECT congregacion_id, tipo_programa INTO _congregacion_id, _tipo
  FROM programas_publicados
  WHERE id = _programa_id;

  IF _congregacion_id IS NULL THEN
    RAISE EXCEPTION 'program_not_found';
  END IF;

  IF NOT public.can_cerrar_programa(_congregacion_id, _tipo) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE programas_publicados
  SET cerrado = false, cerrado_por = NULL, fecha_cierre = NULL
  WHERE id = _programa_id;
END;
$function$;
