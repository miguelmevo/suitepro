-- Cuando se limpia lo auto-aplicado en Vida y Ministerio (porque la entrada
-- de origen se editó o eliminó) y, tras limpiar, ya no queda ningún motivo
-- en esa semana, el interruptor "SR" (Sin reunión) debe apagarse solo —
-- antes quedaba encendido sin motivo, como una semana "Sin reunión" fantasma.
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
BEGIN
  DELETE FROM public.reunion_publica_dias_especiales WHERE origen_dia_especial_id = _id;
  DELETE FROM public.asignaciones_servicio_dias_especiales WHERE origen_dia_especial_id = _id;

  WITH afectados AS (
    UPDATE public.programa_vida_ministerio
    SET sin_reunion_motivo = CASE WHEN sin_reunion_origen_1_id = _id THEN NULL ELSE sin_reunion_motivo END,
        sin_reunion_origen_1_id = CASE WHEN sin_reunion_origen_1_id = _id THEN NULL ELSE sin_reunion_origen_1_id END,
        sin_reunion_motivo_2 = CASE WHEN sin_reunion_origen_2_id = _id THEN NULL ELSE sin_reunion_motivo_2 END,
        sin_reunion_origen_2_id = CASE WHEN sin_reunion_origen_2_id = _id THEN NULL ELSE sin_reunion_origen_2_id END
    WHERE sin_reunion_origen_1_id = _id OR sin_reunion_origen_2_id = _id
    RETURNING id, sin_reunion_motivo, sin_reunion_motivo_2
  )
  UPDATE public.programa_vida_ministerio p
  SET sin_reunion = false
  FROM afectados a
  WHERE p.id = a.id AND a.sin_reunion_motivo IS NULL AND a.sin_reunion_motivo_2 IS NULL;

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

-- Limpieza puntual, SOLO en la congregación de pruebas (Villa Real): datos
-- de días especiales en Vida y Ministerio que quedaron de pruebas
-- anteriores a que existiera el rastreo de origen (sin_reunion_origen_1_id/
-- 2_id), bloqueando la semana del 21 de septiembre sin poder identificar
-- de dónde vinieron. No se toca ninguna otra congregación porque un motivo
-- sin origen puede ser legítimo (escrito a mano por un usuario).
WITH afectados AS (
  UPDATE public.programa_vida_ministerio
  SET sin_reunion_motivo = NULL, sin_reunion_motivo_2 = NULL
  WHERE congregacion_id = '00000000-0000-0000-0000-000000000001'
    AND fecha_semana = '2026-09-21'
    AND sin_reunion = true
    AND sin_reunion_origen_1_id IS NULL
    AND sin_reunion_origen_2_id IS NULL
    AND (sin_reunion_motivo IS NOT NULL OR sin_reunion_motivo_2 IS NOT NULL)
  RETURNING id
)
UPDATE public.programa_vida_ministerio p
SET sin_reunion = false
FROM afectados a
WHERE p.id = a.id;

-- Backfill: recalcula las entradas activas con fecha para que se re-apliquen
-- correctamente ahora que las semanas destino quedaron libres.
UPDATE public.dias_especiales SET nombre = nombre WHERE fecha IS NOT NULL AND activo = true;
