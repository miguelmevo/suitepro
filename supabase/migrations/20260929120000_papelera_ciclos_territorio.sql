-- Papelera de ciclos de territorio: al eliminar o reiniciar un ciclo se guarda
-- una copia (ciclo + manzanas trabajadas) por 12 meses. Las tablas vivas quedan
-- limpias, así que ningún reporte (S-13, historial) ve lo borrado.

CREATE TABLE IF NOT EXISTS public.ciclos_territorio_papelera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territorio_id uuid NOT NULL,
  congregacion_id uuid NOT NULL,
  ciclo jsonb NOT NULL,
  manzanas jsonb NOT NULL DEFAULT '[]'::jsonb,
  eliminado_por uuid,
  eliminado_at timestamptz NOT NULL DEFAULT now(),
  purgar_despues timestamptz NOT NULL DEFAULT (now() + interval '12 months')
);

CREATE INDEX IF NOT EXISTS ciclos_papelera_cong_idx
  ON public.ciclos_territorio_papelera (congregacion_id, eliminado_at DESC);

ALTER TABLE public.ciclos_territorio_papelera ALTER COLUMN purgar_despues SET DEFAULT (now() + interval '12 months');

ALTER TABLE public.ciclos_territorio_papelera ENABLE ROW LEVEL SECURITY;

-- Solo la ven administradores de la congregación (y el super admin).
-- Sin políticas de escritura: solo las funciones de abajo la modifican.
DROP POLICY IF EXISTS "Admins ven la papelera de ciclos" ON public.ciclos_territorio_papelera;
CREATE POLICY "Admins ven la papelera de ciclos"
ON public.ciclos_territorio_papelera FOR SELECT TO authenticated
USING (public.is_admin_in_congregacion(congregacion_id));

-- 1) Eliminar un ciclo (también lo usa "Reiniciar"): guarda copia y borra.
CREATE OR REPLACE FUNCTION public.eliminar_ciclo_territorio(_ciclo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _congregacion_id uuid;
  _territorio_id uuid;
  _bloqueado boolean;
BEGIN
  SELECT congregacion_id, territorio_id, bloqueado
    INTO _congregacion_id, _territorio_id, _bloqueado
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

  INSERT INTO ciclos_territorio_papelera (territorio_id, congregacion_id, ciclo, manzanas, eliminado_por)
  SELECT _territorio_id, _congregacion_id, to_jsonb(c),
         COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.fecha_trabajada) FROM manzanas_trabajadas m WHERE m.ciclo_id = c.id), '[]'::jsonb),
         auth.uid()
  FROM ciclos_territorio c
  WHERE c.id = _ciclo_id;

  DELETE FROM manzanas_trabajadas WHERE ciclo_id = _ciclo_id;
  DELETE FROM ciclos_territorio WHERE id = _ciclo_id;
END;
$function$;

-- 2) Restituir: solo administradores. Rechaza si las fechas del ciclo se cruzan
--    con un ciclo vigente del territorio (abierto o cerrado) y dice cuál.
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

  -- Ciclos vigentes del mismo territorio, con fechas tomadas de sus manzanas.
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

  -- Entra con un número provisional; abajo se renumera todo el territorio por fecha.
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

  -- Los ciclos del territorio quedan numerados 1..n en orden cronológico
  -- (por sus fechas reales de manzanas), así el último número es el más reciente.
  UPDATE ciclos_territorio c
  SET ciclo_numero = o.nuevo
  FROM (
    SELECT c2.id,
           ROW_NUMBER() OVER (
             ORDER BY COALESCE((SELECT MIN(fecha_trabajada) FROM manzanas_trabajadas m WHERE m.ciclo_id = c2.id), c2.fecha_inicio),
                      COALESCE((SELECT MAX(fecha_trabajada) FROM manzanas_trabajadas m WHERE m.ciclo_id = c2.id), c2.fecha_fin, c2.fecha_inicio),
                      c2.ciclo_numero
           ) AS nuevo
    FROM ciclos_territorio c2
    WHERE c2.territorio_id = _p.territorio_id
  ) o
  WHERE c.id = o.id AND c.ciclo_numero IS DISTINCT FROM o.nuevo;

  DELETE FROM ciclos_territorio_papelera WHERE id = _papelera_id;
  RETURN _nuevo_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.restituir_ciclo_territorio(uuid) TO authenticated;

-- 3) Depuración: a los 12 meses se borra de la papelera, todos los días.
CREATE OR REPLACE FUNCTION public.purgar_papelera_ciclos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _n integer;
BEGIN
  DELETE FROM ciclos_territorio_papelera WHERE purgar_despues < now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.purgar_papelera_ciclos() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('purgar-papelera-ciclos');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('purgar-papelera-ciclos', '15 4 * * *', $$SELECT public.purgar_papelera_ciclos();$$);
