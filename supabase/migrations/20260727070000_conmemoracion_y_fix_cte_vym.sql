-- 1) Corrige un bug real de Postgres: encadenar dos UPDATE de la misma tabla
-- vía WITH (CTE modificadora + UPDATE final) sobre programa_vida_ministerio
-- no persistía el segundo UPDATE (sin_reunion no se apagaba), aunque no
-- arrojaba error. Se reemplaza por dos UPDATE simples y secuenciales.
--
-- 2) Regla especial para el motivo "Conmemoración": en vez de aplicarse a
-- todas las reuniones marcadas en "Aplica a" dentro de la semana, se reparte
-- según el día exacto en que cae la fecha:
--   - Entre semana: Vida y Ministerio → Sin reunión; Asignaciones de
--     Servicio → solo su reunión entre semana de esa semana. Reunión
--     Pública no se toca (su reunión de fin de semana sigue normal).
--   - Sábado o domingo: Reunión Pública → día especial esa fecha;
--     Asignaciones de Servicio → solo su reunión de fin de semana de esa
--     semana. Vida y Ministerio no se toca.
-- Solo se tocan los programas que además estén marcados en "Aplica a".
CREATE OR REPLACE FUNCTION public.aplicar_dia_especial_a_programas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid := COALESCE(NEW.id, OLD.id);
  _cfg jsonb;
  _dia_entre_semana text;
  _dia_fin_semana text;
  _fecha_rp date;
  _fecha_asig_entre date;
  _fecha_asig_fin date;
  _lunes_semana_vym date;
  _es_conmemoracion boolean;
  _es_finde boolean;
BEGIN
  DELETE FROM public.reunion_publica_dias_especiales WHERE origen_dia_especial_id = _id;
  DELETE FROM public.asignaciones_servicio_dias_especiales WHERE origen_dia_especial_id = _id;

  UPDATE public.programa_vida_ministerio
  SET sin_reunion_motivo = CASE WHEN sin_reunion_origen_1_id = _id THEN NULL ELSE sin_reunion_motivo END,
      sin_reunion_origen_1_id = CASE WHEN sin_reunion_origen_1_id = _id THEN NULL ELSE sin_reunion_origen_1_id END,
      sin_reunion_motivo_2 = CASE WHEN sin_reunion_origen_2_id = _id THEN NULL ELSE sin_reunion_motivo_2 END,
      sin_reunion_origen_2_id = CASE WHEN sin_reunion_origen_2_id = _id THEN NULL ELSE sin_reunion_origen_2_id END
  WHERE sin_reunion_origen_1_id = _id OR sin_reunion_origen_2_id = _id;

  UPDATE public.programa_vida_ministerio
  SET sin_reunion = false
  WHERE sin_reunion = true AND sin_reunion_motivo IS NULL AND sin_reunion_motivo_2 IS NULL
    AND (sin_reunion_origen_1_id IS NULL AND sin_reunion_origen_2_id IS NULL);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.fecha IS NULL OR NEW.activo IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT valor INTO _cfg
  FROM public.configuracion_sistema
  WHERE congregacion_id = NEW.congregacion_id AND programa_tipo = 'general' AND clave = 'dias_reunion'
  LIMIT 1;

  _dia_entre_semana := COALESCE(_cfg ->> 'dia_entre_semana', 'martes');
  _dia_fin_semana := COALESCE(_cfg ->> 'dia_fin_semana', 'domingo');
  _es_conmemoracion := lower(NEW.nombre) LIKE '%conmemora%';
  _es_finde := EXTRACT(DOW FROM NEW.fecha)::int IN (0, 6);

  IF _es_conmemoracion THEN
    IF NOT _es_finde THEN
      IF 'vida_ministerio' = ANY(NEW.programas) THEN
        _lunes_semana_vym := NEW.fecha - ((EXTRACT(DOW FROM NEW.fecha)::int + 6) % 7);
        PERFORM public.aplicar_sin_reunion_vym(NEW.congregacion_id, _lunes_semana_vym, NEW.nombre, NEW.id);
      END IF;
      IF 'asignaciones_servicio' = ANY(NEW.programas) THEN
        _fecha_asig_entre := public.fecha_reunion_en_semana(NEW.fecha, _dia_entre_semana);
        PERFORM public.aplicar_slot_dia_especial('asignaciones_servicio_dias_especiales', NEW.congregacion_id, _fecha_asig_entre, NEW.nombre, NEW.color, NEW.id);
      END IF;
    ELSE
      IF 'reunion_publica' = ANY(NEW.programas) THEN
        _fecha_rp := public.fecha_reunion_en_semana(NEW.fecha, _dia_fin_semana);
        PERFORM public.aplicar_slot_dia_especial('reunion_publica_dias_especiales', NEW.congregacion_id, _fecha_rp, NEW.nombre, NEW.color, NEW.id);
      END IF;
      IF 'asignaciones_servicio' = ANY(NEW.programas) THEN
        _fecha_asig_fin := public.fecha_reunion_en_semana(NEW.fecha, _dia_fin_semana);
        PERFORM public.aplicar_slot_dia_especial('asignaciones_servicio_dias_especiales', NEW.congregacion_id, _fecha_asig_fin, NEW.nombre, NEW.color, NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF 'reunion_publica' = ANY(NEW.programas) THEN
    _fecha_rp := public.fecha_reunion_en_semana(NEW.fecha, _dia_fin_semana);
    PERFORM public.aplicar_slot_dia_especial('reunion_publica_dias_especiales', NEW.congregacion_id, _fecha_rp, NEW.nombre, NEW.color, NEW.id);
  END IF;

  IF 'asignaciones_servicio' = ANY(NEW.programas) THEN
    _fecha_asig_entre := public.fecha_reunion_en_semana(NEW.fecha, _dia_entre_semana);
    _fecha_asig_fin := public.fecha_reunion_en_semana(NEW.fecha, _dia_fin_semana);
    PERFORM public.aplicar_slot_dia_especial('asignaciones_servicio_dias_especiales', NEW.congregacion_id, _fecha_asig_entre, NEW.nombre, NEW.color, NEW.id);
    IF _fecha_asig_fin <> _fecha_asig_entre THEN
      PERFORM public.aplicar_slot_dia_especial('asignaciones_servicio_dias_especiales', NEW.congregacion_id, _fecha_asig_fin, NEW.nombre, NEW.color, NEW.id);
    END IF;
  END IF;

  IF 'vida_ministerio' = ANY(NEW.programas) THEN
    _lunes_semana_vym := NEW.fecha - ((EXTRACT(DOW FROM NEW.fecha)::int + 6) % 7);
    PERFORM public.aplicar_sin_reunion_vym(NEW.congregacion_id, _lunes_semana_vym, NEW.nombre, NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

-- La limpieza puntual y el backfill pasan por triggers que respetan el
-- bloqueo de "programa cerrado" (trg_enforce_bloqueo); como esta migración
-- corre sin sesión de usuario (no hay super_admin), se envuelven para que un
-- programa cerrado no aborte toda la migración — simplemente se omite y se
-- avisa en el log.
DO $do$
BEGIN
  UPDATE public.programa_vida_ministerio
  SET sin_reunion = false
  WHERE congregacion_id = '00000000-0000-0000-0000-000000000001'
    AND fecha_semana = '2026-09-21'
    AND sin_reunion = true
    AND sin_reunion_motivo IS NULL
    AND sin_reunion_motivo_2 IS NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Limpieza puntual omitida: %', SQLERRM;
END;
$do$;

DO $do$
BEGIN
  UPDATE public.dias_especiales SET nombre = nombre WHERE fecha IS NOT NULL AND activo = true;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill omitido: %', SQLERRM;
END;
$do$;
