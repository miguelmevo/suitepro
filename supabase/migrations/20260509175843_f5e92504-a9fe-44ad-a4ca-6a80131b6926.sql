CREATE OR REPLACE FUNCTION public.reabrir_programa(_programa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _congregacion_id uuid;
  _tipo text;
  _is_admin boolean;
  _is_svministerio boolean;
BEGIN
  SELECT congregacion_id, tipo_programa
    INTO _congregacion_id, _tipo
  FROM programas_publicados
  WHERE id = _programa_id;

  IF _congregacion_id IS NULL THEN
    RAISE EXCEPTION 'program_not_found';
  END IF;

  -- Super admin always allowed
  IF is_super_admin(auth.uid()) THEN
    UPDATE programas_publicados
    SET cerrado = false, cerrado_por = NULL, fecha_cierre = NULL
    WHERE id = _programa_id;
    RETURN;
  END IF;

  -- For vida_ministerio, allow congregation admin or svministerio role
  IF _tipo = 'vida_ministerio' THEN
    SELECT EXISTS (
      SELECT 1 FROM usuarios_congregacion
      WHERE user_id = auth.uid()
        AND congregacion_id = _congregacion_id
        AND rol IN ('admin','svministerio')
        AND activo = true
    ) INTO _is_admin;

    IF _is_admin THEN
      UPDATE programas_publicados
      SET cerrado = false, cerrado_por = NULL, fecha_cierre = NULL
      WHERE id = _programa_id;
      RETURN;
    END IF;
  END IF;

  RAISE EXCEPTION 'Solo super_admin (o admin/S.V. Ministerio para Vida y Ministerio) puede reabrir programas cerrados';
END;
$function$;