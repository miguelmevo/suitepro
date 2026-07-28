-- Extiende el trigger de auto-aplicado de días especiales para que también
-- funcione en Vida y Ministerio, usando su propio concepto de "Sin reunión"
-- (sin_reunion + sin_reunion_motivo / sin_reunion_motivo_2 en la fila
-- semanal), en vez de una tabla lateral de slots como RP/Asignaciones.
-- fecha_semana en programa_vida_ministerio siempre es el LUNES de la
-- semana (no el día real de reunión), así que el motivo se aplica ahí.

ALTER TABLE public.programa_vida_ministerio
  ADD COLUMN sin_reunion_origen_1_id uuid REFERENCES public.dias_especiales(id) ON DELETE SET NULL,
  ADD COLUMN sin_reunion_origen_2_id uuid REFERENCES public.dias_especiales(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.aplicar_sin_reunion_vym(_congregacion_id uuid, _fecha_semana date, _mensaje text, _origen_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existe record;
BEGIN
  SELECT id, sin_reunion_motivo, sin_reunion_motivo_2
  INTO _existe
  FROM public.programa_vida_ministerio
  WHERE congregacion_id = _congregacion_id AND fecha_semana = _fecha_semana;

  IF _existe.id IS NULL THEN
    INSERT INTO public.programa_vida_ministerio (congregacion_id, fecha_semana, sin_reunion, sin_reunion_motivo, sin_reunion_origen_1_id)
    VALUES (_congregacion_id, _fecha_semana, true, _mensaje, _origen_id);
    RETURN;
  END IF;

  IF _existe.sin_reunion_motivo = _mensaje OR _existe.sin_reunion_motivo_2 = _mensaje THEN
    RETURN;
  END IF;

  IF _existe.sin_reunion_motivo IS NULL THEN
    UPDATE public.programa_vida_ministerio
    SET sin_reunion = true, sin_reunion_motivo = _mensaje, sin_reunion_origen_1_id = _origen_id
    WHERE id = _existe.id;
  ELSIF _existe.sin_reunion_motivo_2 IS NULL THEN
    UPDATE public.programa_vida_ministerio
    SET sin_reunion = true, sin_reunion_motivo_2 = _mensaje, sin_reunion_origen_2_id = _origen_id
    WHERE id = _existe.id;
  END IF;
END;
$function$;

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

  UPDATE public.programa_vida_ministerio
  SET sin_reunion_motivo = NULL, sin_reunion_origen_1_id = NULL
  WHERE sin_reunion_origen_1_id = _id;

  UPDATE public.programa_vida_ministerio
  SET sin_reunion_motivo_2 = NULL, sin_reunion_origen_2_id = NULL
  WHERE sin_reunion_origen_2_id = _id;

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

-- Backfill: recalcula todas las entradas activas con fecha (incluye
-- Vida y Ministerio para las que ya existían de la etapa anterior).
UPDATE public.dias_especiales SET nombre = nombre WHERE fecha IS NOT NULL AND activo = true;
