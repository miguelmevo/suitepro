-- Numeración automática de los ciclos de cada territorio, siempre por fecha.
--  * Los ciclos BLOQUEADOS conservan su número.
--  * Los demás se reparten los números restantes en orden cronológico
--    (fechas reales de sus manzanas trabajadas).
--  * El ciclo en progreso siempre lleva el número más alto.
-- Se recalcula sola al crear/eliminar un ciclo, completarlo, o crear/editar/
-- borrar una manzana trabajada.

CREATE OR REPLACE FUNCTION public.calcular_numeracion_ciclos(_territorio_id uuid)
RETURNS TABLE (ciclo_id uuid, numero_actual integer, numero_nuevo integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH c AS (
    SELECT ct.id, ct.ciclo_numero, ct.completado, COALESCE(ct.bloqueado, false) AS bloqueado,
           COALESCE((SELECT MIN(m.fecha_trabajada) FROM manzanas_trabajadas m WHERE m.ciclo_id = ct.id), ct.fecha_inicio) AS ini,
           COALESCE((SELECT MAX(m.fecha_trabajada) FROM manzanas_trabajadas m WHERE m.ciclo_id = ct.id), ct.fecha_fin, ct.fecha_inicio) AS fin
    FROM ciclos_territorio ct
    WHERE ct.territorio_id = _territorio_id
  ),
  libres AS (
    SELECT g AS numero, ROW_NUMBER() OVER (ORDER BY g) AS rn
    FROM generate_series(1, (SELECT COUNT(*)::int FROM c)) g
    WHERE g NOT IN (SELECT ciclo_numero FROM c WHERE bloqueado)
  ),
  orden AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY (NOT completado), ini, fin, ciclo_numero, id) AS rn
    FROM c
    WHERE NOT bloqueado
  )
  SELECT c.id, c.ciclo_numero,
         CASE WHEN c.bloqueado THEN c.ciclo_numero ELSE l.numero END
  FROM c
  LEFT JOIN orden o ON o.id = c.id
  LEFT JOIN libres l ON l.rn = o.rn;
$$;

CREATE OR REPLACE FUNCTION public.renumerar_ciclos_territorio(_territorio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE ciclos_territorio t
  SET ciclo_numero = n.numero_nuevo
  FROM calcular_numeracion_ciclos(_territorio_id) n
  WHERE t.id = n.ciclo_id
    AND n.numero_nuevo IS NOT NULL
    AND t.ciclo_numero IS DISTINCT FROM n.numero_nuevo;
END;
$$;

REVOKE ALL ON FUNCTION public.renumerar_ciclos_territorio(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calcular_numeracion_ciclos(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_renumerar_ciclos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _territorio uuid;
BEGIN
  -- Evita bucles: el propio renumerado dispara otros triggers (auditoría).
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;
  _territorio := CASE WHEN TG_OP = 'DELETE' THEN OLD.territorio_id ELSE NEW.territorio_id END;
  PERFORM public.renumerar_ciclos_territorio(_territorio);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS renumerar_ciclos_por_ciclo ON public.ciclos_territorio;
CREATE TRIGGER renumerar_ciclos_por_ciclo
AFTER INSERT OR DELETE OR UPDATE OF completado, fecha_inicio, fecha_fin, bloqueado ON public.ciclos_territorio
FOR EACH ROW EXECUTE FUNCTION public.trg_renumerar_ciclos();

DROP TRIGGER IF EXISTS renumerar_ciclos_por_manzana ON public.manzanas_trabajadas;
CREATE TRIGGER renumerar_ciclos_por_manzana
AFTER INSERT OR DELETE OR UPDATE OF fecha_trabajada, ciclo_id ON public.manzanas_trabajadas
FOR EACH ROW EXECUTE FUNCTION public.trg_renumerar_ciclos();

-- Restituir desde la papelera: la renumeración la hace ahora el disparador.
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

  INSERT INTO manzanas_trabajadas (ciclo_id, manzana_id, territorio_id, congregacion_id, fecha_trabajada, marcado_por)
  SELECT _nuevo_id, (m->>'manzana_id')::uuid, _p.territorio_id, _p.congregacion_id,
         (m->>'fecha_trabajada')::date, (m->>'marcado_por')::uuid
  FROM jsonb_array_elements(_p.manzanas) m;

  -- Los triggers de arriba no corren dentro de otro trigger; se asegura aquí.
  PERFORM public.renumerar_ciclos_territorio(_p.territorio_id);

  DELETE FROM ciclos_territorio_papelera WHERE id = _papelera_id;
  RETURN _nuevo_id;
END;
$function$;

-- Pasada única: deja ordenados los ciclos que ya existen.
DO $$
DECLARE
  _t uuid;
BEGIN
  FOR _t IN SELECT DISTINCT territorio_id FROM public.ciclos_territorio LOOP
    PERFORM public.renumerar_ciclos_territorio(_t);
  END LOOP;
END $$;
