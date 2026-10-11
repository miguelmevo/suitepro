-- Capitán de las manzanas sin necesidad de cuenta de usuario.
--
-- Hasta ahora manzanas_trabajadas.marcado_por (obligatorio) guardaba el ID de
-- USUARIO del capitán, así que sólo se podía elegir a quien tuviera cuenta.
-- Se agrega capitan_participante_id (opcional): el capitán real, con o sin
-- cuenta. marcado_por no cambia de significado: si el capitán tiene cuenta
-- activa sigue siendo su usuario; si no, queda quien hizo el registro.
-- Lectura: quién fue el capitán = capitan_participante_id, y si es NULL
-- (registros anteriores) el participante del usuario marcado_por.

ALTER TABLE public.manzanas_trabajadas
  ADD COLUMN IF NOT EXISTS capitan_participante_id uuid
  REFERENCES public.participantes(id) ON DELETE SET NULL;

-- Registros existentes: se completa con el participante del usuario que los marcó.
UPDATE public.manzanas_trabajadas mt
SET capitan_participante_id = p.id
FROM public.participantes p
WHERE mt.capitan_participante_id IS NULL
  AND p.user_id = mt.marcado_por
  AND p.congregacion_id = mt.congregacion_id;

-- Capitanes para el selector: todos los participantes activos con "Capitán de
-- grupo" (tengan o no cuenta). user_id sólo viene cuando tienen cuenta activa.
DROP FUNCTION IF EXISTS public.obtener_capitanes_para_historial(uuid);
CREATE FUNCTION public.obtener_capitanes_para_historial(_congregacion_id uuid)
RETURNS TABLE (participante_id uuid, user_id uuid, nombre text, apellido text)
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
  SELECT p.id,
         CASE WHEN uc.activo = true THEN p.user_id ELSE NULL END,
         p.nombre, p.apellido
  FROM public.participantes p
  LEFT JOIN public.usuarios_congregacion uc ON uc.user_id = p.user_id AND uc.congregacion_id = p.congregacion_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.congregacion_id = _congregacion_id
    AND p.activo = true
    AND p.es_capitan_grupo = true
    AND COALESCE(p.es_publicador_inactivo, false) = false
    AND lower(coalesce(pr.email, '')) <> 'miguelmevo@gmail.com'
  ORDER BY p.nombre, p.apellido;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.obtener_capitanes_para_historial(uuid) TO authenticated;

-- Nombres: ahora la clave puede ser un ID de usuario o un ID de participante
-- (son UUID distintos, no chocan).
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
            WHERE p.id = u.id AND p.congregacion_id = _congregacion_id LIMIT 1),
           (SELECT trim(p.nombre || ' ' || p.apellido) FROM public.participantes p
            WHERE p.user_id = u.id AND p.congregacion_id = _congregacion_id LIMIT 1),
           (SELECT trim(coalesce(pr.nombre, '') || ' ' || coalesce(pr.apellido, '')) FROM public.profiles pr WHERE pr.id = u.id)
         )
  FROM unnest(_user_ids) AS u(id);
END;
$function$;

-- Registrar una manzana. Nuevo parámetro _capitan_participante_id.
DROP FUNCTION IF EXISTS public.marcar_manzana_trabajada(uuid, uuid, uuid, date, uuid);
CREATE FUNCTION public.marcar_manzana_trabajada(
  _territorio_id uuid,
  _congregacion_id uuid,
  _manzana_id uuid,
  _fecha_trabajada date DEFAULT CURRENT_DATE,
  _marcado_por uuid DEFAULT NULL,
  _capitan_participante_id uuid DEFAULT NULL
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
BEGIN
  IF NOT (
    is_capitan_in_congregacion(_congregacion_id)
    OR is_admin_or_editor_in_congregacion(_congregacion_id)
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'crear')
    OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_territorios_historial', 'editar')
  ) THEN
    RAISE EXCEPTION 'not_authorized_captain';
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

GRANT EXECUTE ON FUNCTION public.marcar_manzana_trabajada(uuid, uuid, uuid, date, uuid, uuid) TO authenticated;

-- Cambiar el capitán de manzanas ya registradas (un grupo de la misma fecha).
CREATE OR REPLACE FUNCTION public.actualizar_capitan_manzanas(_ids uuid[], _capitan_participante_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _congs uuid[];
  _cong uuid;
  _cap record;
  _marcado_por_final uuid;
BEGIN
  SELECT array_agg(DISTINCT congregacion_id) INTO _congs FROM manzanas_trabajadas WHERE id = ANY(_ids);
  IF _congs IS NULL OR array_length(_congs, 1) <> 1 THEN
    RAISE EXCEPTION 'registros_invalidos';
  END IF;
  _cong := _congs[1];

  IF NOT (
    is_admin_or_editor_in_congregacion(_cong)
    OR public.has_permission(auth.uid(), _cong, 'predicacion_territorios_historial', 'editar')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT p.id, p.user_id,
         EXISTS (SELECT 1 FROM usuarios_congregacion uc
                 WHERE uc.user_id = p.user_id AND uc.congregacion_id = p.congregacion_id AND uc.activo = true) AS con_cuenta
    INTO _cap
  FROM participantes p
  WHERE p.id = _capitan_participante_id
    AND p.congregacion_id = _cong
    AND p.es_capitan_grupo = true
    AND p.activo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'capitan_invalido';
  END IF;

  _marcado_por_final := CASE WHEN _cap.con_cuenta THEN _cap.user_id ELSE auth.uid() END;

  UPDATE manzanas_trabajadas
  SET capitan_participante_id = _cap.id,
      marcado_por = _marcado_por_final
  WHERE id = ANY(_ids);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_capitan_manzanas(uuid[], uuid) TO authenticated;

-- Historial público de manzanas de un territorio: el responsable sale del
-- capitán real. "marcado_por" devuelve la clave de agrupación (capitán real).
CREATE OR REPLACE FUNCTION public.get_historial_manzanas_territorio_publico(_territorio_id uuid)
RETURNS TABLE (
  id uuid,
  letra text,
  fecha_trabajada date,
  marcado_por uuid,
  responsable_nombre text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mt.id,
    mz.letra,
    mt.fecha_trabajada,
    COALESCE(mt.capitan_participante_id, mt.marcado_por) AS marcado_por,
    COALESCE(pc.nombre || ' ' || pc.apellido, p.nombre || ' ' || p.apellido, pr.nombre || ' ' || pr.apellido, '—') AS responsable_nombre
  FROM public.manzanas_trabajadas mt
  JOIN public.manzanas_territorio mz ON mz.id = mt.manzana_id
  LEFT JOIN public.participantes pc ON pc.id = mt.capitan_participante_id
  LEFT JOIN public.participantes p ON p.user_id = mt.marcado_por AND p.congregacion_id = mt.congregacion_id
  LEFT JOIN public.profiles pr ON pr.id = mt.marcado_por
  WHERE mt.territorio_id = _territorio_id
  ORDER BY mt.fecha_trabajada DESC, mz.letra ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_historial_manzanas_territorio_publico(uuid) TO anon, authenticated;

-- Restaurar un ciclo desde la papelera: conserva también el capitán real.
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

  INSERT INTO manzanas_trabajadas (ciclo_id, manzana_id, territorio_id, congregacion_id, fecha_trabajada, marcado_por, capitan_participante_id)
  SELECT _nuevo_id, (m->>'manzana_id')::uuid, _p.territorio_id, _p.congregacion_id,
         (m->>'fecha_trabajada')::date, (m->>'marcado_por')::uuid,
         -- el capitán puede haberse borrado mientras el ciclo estaba en la papelera
         (SELECT pp.id FROM participantes pp WHERE pp.id = NULLIF(m->>'capitan_participante_id', '')::uuid)
  FROM jsonb_array_elements(_p.manzanas) m;

  -- Los triggers de arriba no corren dentro de otro trigger; se asegura aquí.
  PERFORM public.renumerar_ciclos_territorio(_p.territorio_id);

  DELETE FROM ciclos_territorio_papelera WHERE id = _papelera_id;
  RETURN _nuevo_id;
END;
$function$;
