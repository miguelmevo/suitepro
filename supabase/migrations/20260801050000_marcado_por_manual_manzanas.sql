-- Permite indicar manualmente qué capitán registró el inicio/fin de un territorio
CREATE OR REPLACE FUNCTION public.marcar_manzana_trabajada(
  _territorio_id uuid,
  _congregacion_id uuid,
  _manzana_id uuid,
  _fecha_trabajada date DEFAULT CURRENT_DATE,
  _marcado_por uuid DEFAULT NULL
)
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
  _marcado_por_final uuid;
BEGIN
  IF NOT (
    is_capitan_in_congregacion(_congregacion_id)
    OR is_admin_or_editor_in_congregacion(_congregacion_id)
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'crear')
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'editar')
  ) THEN
    RAISE EXCEPTION 'not_authorized_captain';
  END IF;

  IF _marcado_por IS NOT NULL AND EXISTS (
    SELECT 1 FROM participantes
    WHERE user_id = _marcado_por
      AND congregacion_id = _congregacion_id
      AND es_capitan_grupo = true
      AND activo = true
  ) THEN
    _marcado_por_final := _marcado_por;
  ELSE
    _marcado_por_final := auth.uid();
  END IF;

  _ciclo_id := get_or_create_ciclo_activo(_territorio_id, _congregacion_id);
  INSERT INTO manzanas_trabajadas (ciclo_id, manzana_id, territorio_id, congregacion_id, fecha_trabajada, marcado_por)
  VALUES (_ciclo_id, _manzana_id, _territorio_id, _congregacion_id, _fecha_trabajada, _marcado_por_final)
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
