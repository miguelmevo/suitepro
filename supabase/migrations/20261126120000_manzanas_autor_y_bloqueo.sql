-- Registro de manzanas: quién lo ingresó y bloqueo de reenvío por 12 horas.

-- 1) Quién ingresó cada registro (puede ser distinto del capitán elegido).
ALTER TABLE public.manzanas_trabajadas ADD COLUMN IF NOT EXISTS registrado_por uuid;

-- Registros anteriores: se completan con la auditoría, cuando existe. Si un
-- registro volvió desde la papelera, vale quien lo ingresó la primera vez y no
-- quien lo restituyó.
WITH original AS (
  SELECT mt.id,
         COALESCE(
           (SELECT ins.user_id
              FROM public.audit_log del
              JOIN public.audit_log ins
                ON ins.tabla = del.tabla AND ins.registro_id = del.registro_id AND ins.operacion = 'INSERT'
             WHERE del.tabla = 'manzanas_trabajadas' AND del.operacion = 'DELETE'
               AND del.congregacion_id = mt.congregacion_id
               AND del.created_at <= mt.created_at
               AND del.datos_anteriores->>'manzana_id' = mt.manzana_id::text
               AND del.datos_anteriores->>'fecha_trabajada' = mt.fecha_trabajada::text
               AND del.datos_anteriores->>'marcado_por' = mt.marcado_por::text
             ORDER BY ins.created_at
             LIMIT 1),
           (SELECT a.user_id
              FROM public.audit_log a
             WHERE a.tabla = 'manzanas_trabajadas' AND a.operacion = 'INSERT' AND a.registro_id = mt.id
             ORDER BY a.created_at
             LIMIT 1)
         ) AS user_id
  FROM public.manzanas_trabajadas mt
  WHERE mt.registrado_por IS NULL
)
UPDATE public.manzanas_trabajadas mt
SET registrado_por = o.user_id
FROM original o
WHERE o.id = mt.id AND o.user_id IS NOT NULL;

ALTER TABLE public.manzanas_trabajadas ALTER COLUMN registrado_por SET DEFAULT auth.uid();

-- 2) Bloqueo opcional por congregación (Ajustes > Predicación; apagado por defecto).
CREATE OR REPLACE FUNCTION public.bloqueo_manzanas_activo(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT (valor->>'activo')::boolean
    FROM configuracion_sistema
    WHERE congregacion_id = _congregacion_id
      AND programa_tipo = 'predicacion'
      AND clave = 'bloqueo_manzanas'
    LIMIT 1
  ), false);
$$;
REVOKE ALL ON FUNCTION public.bloqueo_manzanas_activo(uuid) FROM PUBLIC, anon, authenticated;

-- Manzanas enviadas hace menos de 12 horas. Las cargas con fecha atrasada (hechas
-- desde el Historial) no cuentan.
CREATE OR REPLACE FUNCTION public.manzanas_enviadas_recientes(_territorio_id uuid)
RETURNS TABLE (manzana_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT mt.manzana_id
  FROM manzanas_trabajadas mt
  WHERE mt.territorio_id = _territorio_id
    AND mt.created_at > now() - interval '12 hours'
    AND mt.fecha_trabajada >= (mt.created_at AT TIME ZONE 'America/Santiago')::date;
$$;
REVOKE ALL ON FUNCTION public.manzanas_enviadas_recientes(uuid) FROM PUBLIC, anon, authenticated;

-- Estado que necesitan la ficha y el Historial antes de registrar.
CREATE OR REPLACE FUNCTION public.get_estado_registro_manzanas(_territorio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cong uuid;
BEGIN
  SELECT congregacion_id INTO _cong FROM territorios WHERE id = _territorio_id;

  IF _cong IS NULL OR NOT COALESCE(
    is_capitan_in_congregacion(_cong)
    OR is_admin_or_editor_in_congregacion(_cong)
    OR public.has_permission(auth.uid(), _cong, 'predicacion_territorios_historial', 'crear')
    OR public.has_permission(auth.uid(), _cong, 'predicacion_territorios_historial', 'editar'), false) THEN
    RETURN jsonb_build_object('bloqueo_activo', false, 'recientes', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'bloqueo_activo', public.bloqueo_manzanas_activo(_cong),
    'recientes', COALESCE((SELECT jsonb_agg(r.manzana_id) FROM public.manzanas_enviadas_recientes(_territorio_id) r), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_estado_registro_manzanas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_estado_registro_manzanas(uuid) TO authenticated;

-- 3) Registros ingresados por alguien distinto del capitán (icono del Historial).
-- El super admin nunca se muestra.
CREATE OR REPLACE FUNCTION public.obtener_registros_por_terceros(_congregacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT COALESCE(public.puede_ver_historial_territorios(_congregacion_id), false) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', mt.id,
      'nombre', COALESCE(
        (SELECT trim(p.nombre || ' ' || p.apellido) FROM participantes p
          WHERE p.user_id = mt.registrado_por AND p.congregacion_id = _congregacion_id LIMIT 1),
        (SELECT trim(coalesce(pr.nombre, '') || ' ' || coalesce(pr.apellido, '')) FROM profiles pr
          WHERE pr.id = mt.registrado_por)
      )
    ))
    FROM manzanas_trabajadas mt
    LEFT JOIN participantes cap ON cap.id = mt.capitan_participante_id
    WHERE mt.congregacion_id = _congregacion_id
      AND mt.registrado_por IS NOT NULL
      AND NOT COALESCE(public.is_super_admin(mt.registrado_por), false)
      AND mt.registrado_por IS DISTINCT FROM
          (CASE WHEN mt.capitan_participante_id IS NULL THEN mt.marcado_por ELSE cap.user_id END)
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.obtener_registros_por_terceros(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_registros_por_terceros(uuid) TO authenticated;

-- 4) Registrar manzanas, ahora con el bloqueo.
DROP FUNCTION IF EXISTS public.marcar_manzana_trabajada(uuid, uuid, uuid, date, uuid, uuid);
CREATE FUNCTION public.marcar_manzana_trabajada(
  _territorio_id uuid,
  _congregacion_id uuid,
  _manzana_id uuid,
  _fecha_trabajada date DEFAULT CURRENT_DATE,
  _marcado_por uuid DEFAULT NULL,
  _capitan_participante_id uuid DEFAULT NULL,
  _desde_historial boolean DEFAULT false
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
  _capitan_final uuid;
  _cap record;
  _desde_ficha boolean;
BEGIN
  IF NOT (
    is_capitan_in_congregacion(_congregacion_id)
    OR is_admin_or_editor_in_congregacion(_congregacion_id)
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'crear')
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'editar')
  ) THEN
    RAISE EXCEPTION 'not_authorized_captain';
  END IF;

  -- Bloqueo de 12 horas (si la congregación lo activó): evita reenviar la misma
  -- manzana desde la ficha. El Historial de territorios nunca se bloquea.
  _desde_ficha := NOT COALESCE(
    (COALESCE(_desde_historial, false) OR _capitan_participante_id IS NOT NULL OR _marcado_por IS NOT NULL)
    AND (
      is_admin_or_editor_in_congregacion(_congregacion_id)
      OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'crear')
      OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'editar')
    ), false);

  IF _desde_ficha
     AND public.bloqueo_manzanas_activo(_congregacion_id)
     AND EXISTS (
       SELECT 1 FROM public.manzanas_enviadas_recientes(_territorio_id) r WHERE r.manzana_id = _manzana_id
     )
     -- si ya está en el ciclo abierto no se vuelve a insertar: no es un reenvío
     AND NOT EXISTS (
       SELECT 1 FROM manzanas_trabajadas mt
       JOIN ciclos_territorio c ON c.id = mt.ciclo_id AND c.completado = false
       WHERE mt.manzana_id = _manzana_id AND c.territorio_id = _territorio_id
     ) THEN
    RAISE EXCEPTION 'manzana_bloqueada';
  END IF;

  _marcado_por_final := auth.uid();

  IF _capitan_participante_id IS NOT NULL THEN
    SELECT p.id, p.user_id,
           EXISTS (SELECT 1 FROM usuarios_congregacion uc
                   WHERE uc.user_id = p.user_id AND uc.congregacion_id = p.congregacion_id AND uc.activo = true) AS con_cuenta
      INTO _cap
    FROM participantes p
    WHERE p.id = _capitan_participante_id
      AND p.congregacion_id = _congregacion_id
      AND p.es_capitan_grupo = true
      AND p.activo = true;
    IF FOUND THEN
      _capitan_final := _cap.id;
      IF _cap.con_cuenta THEN
        _marcado_por_final := _cap.user_id;
      END IF;
    END IF;
  ELSIF _marcado_por IS NOT NULL THEN
    SELECT p.id INTO _capitan_final
    FROM participantes p
    WHERE p.user_id = _marcado_por
      AND p.congregacion_id = _congregacion_id
      AND p.es_capitan_grupo = true
      AND p.activo = true;
    IF FOUND THEN
      _marcado_por_final := _marcado_por;
    END IF;
  END IF;

  -- Sin capitán indicado: queda como capitán quien registra, si tiene ficha.
  IF _capitan_final IS NULL THEN
    SELECT p.id INTO _capitan_final
    FROM participantes p
    WHERE p.user_id = auth.uid() AND p.congregacion_id = _congregacion_id
    LIMIT 1;
  END IF;

  _ciclo_id := get_or_create_ciclo_activo(_territorio_id, _congregacion_id);
  INSERT INTO manzanas_trabajadas (ciclo_id, manzana_id, territorio_id, congregacion_id, fecha_trabajada, marcado_por, capitan_participante_id)
  VALUES (_ciclo_id, _manzana_id, _territorio_id, _congregacion_id, _fecha_trabajada, _marcado_por_final, _capitan_final)
  ON CONFLICT (manzana_id, ciclo_id) DO NOTHING;

  UPDATE ciclos_territorio
  SET fecha_inicio = (SELECT MIN(fecha_trabajada) FROM manzanas_trabajadas WHERE ciclo_id = _ciclo_id)
  WHERE id = _ciclo_id;

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
GRANT EXECUTE ON FUNCTION public.marcar_manzana_trabajada(uuid, uuid, uuid, date, uuid, uuid, boolean) TO authenticated;

-- 5) Restituir desde la papelera conserva autor y fecha de ingreso.
CREATE OR REPLACE FUNCTION public.restituir_ciclo_territorio(_papelera_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p ciclos_territorio_papelera%ROWTYPE;
  _numero_terr text;
  _completado boolean;
  _ini date;
  _fin date;
  _abierto boolean;
  _conflictos text := '';
  _c record;
  _c_ini date;
  _c_fin date;
  _c_abierto boolean;
  _nuevo_id uuid;
  _numero integer;
  _fmt text := 'DD/MM/YYYY';
BEGIN
  SELECT * INTO _p FROM ciclos_territorio_papelera WHERE id = _papelera_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ese ciclo ya no está en la papelera';
  END IF;

  IF NOT public.is_admin_in_congregacion(_p.congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT numero INTO _numero_terr FROM territorios WHERE id = _p.territorio_id;
  IF _numero_terr IS NULL THEN
    RAISE EXCEPTION 'El territorio de este ciclo ya no existe';
  END IF;

  _completado := COALESCE((_p.ciclo->>'completado')::boolean, false);
  _abierto := NOT _completado;

  SELECT COALESCE(MIN((m->>'fecha_trabajada')::date), (_p.ciclo->>'fecha_inicio')::date),
         COALESCE(MAX((m->>'fecha_trabajada')::date), (_p.ciclo->>'fecha_fin')::date, (_p.ciclo->>'fecha_inicio')::date)
    INTO _ini, _fin
  FROM jsonb_array_elements(_p.manzanas) m;
  IF _ini IS NULL THEN _ini := (_p.ciclo->>'fecha_inicio')::date; END IF;
  IF _fin IS NULL THEN _fin := _ini; END IF;
  IF _abierto THEN _fin := GREATEST(_fin, CURRENT_DATE); END IF;

  FOR _c IN
    SELECT c.id, c.ciclo_numero, c.completado, c.fecha_inicio, c.fecha_fin,
           (SELECT MIN(fecha_trabajada) FROM manzanas_trabajadas m WHERE m.ciclo_id = c.id) AS m_ini,
           (SELECT MAX(fecha_trabajada) FROM manzanas_trabajadas m WHERE m.ciclo_id = c.id) AS m_fin
    FROM ciclos_territorio c
    WHERE c.territorio_id = _p.territorio_id
    ORDER BY c.ciclo_numero
  LOOP
    _c_ini := COALESCE(_c.m_ini, _c.fecha_inicio);
    _c_abierto := NOT _c.completado;
    _c_fin := COALESCE(_c.m_fin, _c.fecha_fin, _c.fecha_inicio);
    IF _c_abierto THEN _c_fin := GREATEST(_c_fin, CURRENT_DATE); END IF;

    IF _abierto AND _c_abierto THEN
      _conflictos := _conflictos || format(E'\n- ciclo #%s en progreso (desde %s): solo puede haber un ciclo abierto por territorio',
        _c.ciclo_numero, to_char(_c_ini, _fmt));
    -- Cruce real: compartir solo el día de borde (uno termina el día en que empieza el otro) es válido.
    ELSIF _ini < _c_fin AND _c_ini < _fin THEN
      _conflictos := _conflictos || format(E'\n- ciclo #%s, %s (%s al %s)',
        _c.ciclo_numero,
        CASE WHEN _c_abierto THEN 'en progreso' ELSE 'cerrado' END,
        to_char(_c_ini, _fmt),
        CASE WHEN _c_abierto THEN 'hoy' ELSE to_char(_c_fin, _fmt) END);
    END IF;
  END LOOP;

  IF _conflictos <> '' THEN
    RAISE EXCEPTION E'No se puede restituir el ciclo #% del territorio % (% al %): sus fechas coinciden con:%',
      _p.ciclo->>'ciclo_numero', _numero_terr, to_char(_ini, _fmt),
      CASE WHEN _abierto THEN 'hoy' ELSE to_char(_fin, _fmt) END, _conflictos;
  END IF;

  -- Número provisional; el disparador renumera el territorio por fecha.
  SELECT COALESCE(MAX(ciclo_numero), 0) + 1 INTO _numero FROM ciclos_territorio WHERE territorio_id = _p.territorio_id;

  _nuevo_id := (_p.ciclo->>'id')::uuid;
  IF EXISTS (SELECT 1 FROM ciclos_territorio WHERE id = _nuevo_id) THEN
    _nuevo_id := gen_random_uuid();
  END IF;

  INSERT INTO ciclos_territorio (id, territorio_id, congregacion_id, ciclo_numero, fecha_inicio, fecha_fin, completado, bloqueado)
  VALUES (_nuevo_id, _p.territorio_id, _p.congregacion_id, _numero,
          (_p.ciclo->>'fecha_inicio')::date,
          NULLIF(_p.ciclo->>'fecha_fin', '')::date,
          _completado,
          COALESCE((_p.ciclo->>'bloqueado')::boolean, false));

  -- Conserva quién lo ingresó y cuándo: restituir no es un registro nuevo.
  INSERT INTO manzanas_trabajadas (ciclo_id, manzana_id, territorio_id, congregacion_id, fecha_trabajada, marcado_por, capitan_participante_id, registrado_por, created_at)
  SELECT _nuevo_id, (m->>'manzana_id')::uuid, _p.territorio_id, _p.congregacion_id,
         (m->>'fecha_trabajada')::date, (m->>'marcado_por')::uuid,
         -- el capitán puede haberse borrado mientras el ciclo estaba en la papelera
         (SELECT pp.id FROM participantes pp WHERE pp.id = NULLIF(m->>'capitan_participante_id', '')::uuid),
         NULLIF(m->>'registrado_por', '')::uuid,
         COALESCE((m->>'created_at')::timestamptz, now() - interval '1 day')
  FROM jsonb_array_elements(_p.manzanas) m;

  -- Los triggers de arriba no corren dentro de otro trigger; se asegura aquí.
  PERFORM public.renumerar_ciclos_territorio(_p.territorio_id);

  DELETE FROM ciclos_territorio_papelera WHERE id = _papelera_id;
  RETURN _nuevo_id;
END;
$function$;
