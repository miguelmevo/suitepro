CREATE OR REPLACE FUNCTION public.marcar_manzana_trabajada(_territorio_id uuid, _congregacion_id uuid, _manzana_id uuid, _fecha_trabajada date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ciclo_id uuid;
  _total_manzanas integer;
  _trabajadas integer;
  _ciclo_completado boolean := false;
BEGIN
  IF NOT (
    is_capitan_in_congregacion(_congregacion_id)
    OR is_admin_or_editor_in_congregacion(_congregacion_id)
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'crear')
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'editar')
  ) THEN
    RAISE EXCEPTION 'not_authorized_captain';
  END IF;

  _ciclo_id := get_or_create_ciclo_activo(_territorio_id, _congregacion_id);
  INSERT INTO manzanas_trabajadas (ciclo_id, manzana_id, territorio_id, congregacion_id, fecha_trabajada, marcado_por)
  VALUES (_ciclo_id, _manzana_id, _territorio_id, _congregacion_id, _fecha_trabajada, auth.uid())
  ON CONFLICT (manzana_id, ciclo_id) DO NOTHING;

  SELECT COUNT(*) INTO _total_manzanas
  FROM manzanas_territorio
  WHERE territorio_id = _territorio_id
    AND congregacion_id = _congregacion_id
    AND activo = true;

  SELECT COUNT(*) INTO _trabajadas
  FROM manzanas_trabajadas
  WHERE ciclo_id = _ciclo_id;

  IF _trabajadas >= _total_manzanas AND _total_manzanas > 0 THEN
    UPDATE ciclos_territorio
    SET completado = true,
        fecha_fin = _fecha_trabajada
    WHERE id = _ciclo_id;
    _ciclo_completado := true;
  END IF;

  RETURN jsonb_build_object(
    'ciclo_id', _ciclo_id,
    'total_manzanas', _total_manzanas,
    'trabajadas', _trabajadas,
    'ciclo_completado', _ciclo_completado
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.desmarcar_manzana_trabajada(_manzana_trabajada_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _congregacion_id uuid;
  _ciclo_completado boolean;
BEGIN
  SELECT mt.congregacion_id, ct.completado 
  INTO _congregacion_id, _ciclo_completado
  FROM manzanas_trabajadas mt
  JOIN ciclos_territorio ct ON ct.id = mt.ciclo_id
  WHERE mt.id = _manzana_trabajada_id;

  IF _congregacion_id IS NULL THEN
    RAISE EXCEPTION 'record_not_found';
  END IF;

  IF NOT (
    is_capitan_in_congregacion(_congregacion_id)
    OR is_admin_or_editor_in_congregacion(_congregacion_id)
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'editar')
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'eliminar')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _ciclo_completado THEN
    RAISE EXCEPTION 'cycle_already_completed';
  END IF;

  DELETE FROM manzanas_trabajadas WHERE id = _manzana_trabajada_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_bloqueo_ciclo(_ciclo_id uuid, _bloqueado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM ciclos_territorio ct
      WHERE ct.id = _ciclo_id
        AND (
          is_admin_or_editor_in_congregacion(ct.congregacion_id)
          OR public.has_permission(auth.uid(), ct.congregacion_id, 'predicacion_territorios_historial', 'editar')
        )
    ) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
  END IF;

  UPDATE ciclos_territorio
  SET bloqueado = _bloqueado
  WHERE id = _ciclo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.eliminar_ciclo_territorio(_ciclo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _congregacion_id uuid;
  _bloqueado boolean;
BEGIN
  SELECT congregacion_id, bloqueado
    INTO _congregacion_id, _bloqueado
  FROM ciclos_territorio
  WHERE id = _ciclo_id;

  IF _congregacion_id IS NULL THEN
    RAISE EXCEPTION 'cycle_not_found';
  END IF;

  IF _bloqueado AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'cycle_locked';
  END IF;

  IF NOT _bloqueado AND NOT (
    is_admin_or_editor_in_congregacion(_congregacion_id)
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'eliminar')
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'editar')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM manzanas_trabajadas WHERE ciclo_id = _ciclo_id;
  DELETE FROM ciclos_territorio WHERE id = _ciclo_id;
END;
$function$;