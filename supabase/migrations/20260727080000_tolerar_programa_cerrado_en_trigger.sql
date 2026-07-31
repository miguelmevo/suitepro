-- Las tablas de programa (incluida programa_vida_ministerio) tienen un
-- trigger que bloquea escrituras si el programa de esa fecha está cerrado
-- (trg_enforce_bloqueo). Como el trigger de auto-aplicado de días
-- especiales corre en la MISMA transacción que el guardado en Ajustes, si
-- CUALQUIER semana de Vida y Ministerio tocada estaba cerrada, la excepción
-- abortaba toda la operación — impidiendo guardar el día especial aunque no
-- tuviera nada que ver con esa semana cerrada. Se envuelven las escrituras a
-- programa_vida_ministerio para que un programa cerrado se omita en vez de
-- abortar todo.
CREATE OR REPLACE FUNCTION public.aplicar_sin_reunion_vym(_congregacion_id uuid, _fecha_semana date, _mensaje text, _origen_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existe record;
  _es_conmemoracion boolean := lower(_mensaje) LIKE '%conmemora%';
  _slot int;
BEGIN
  SELECT id, sin_reunion_motivo, sin_reunion_motivo_2
  INTO _existe
  FROM public.programa_vida_ministerio
  WHERE congregacion_id = _congregacion_id AND fecha_semana = _fecha_semana;

  IF _existe.id IS NOT NULL AND (_existe.sin_reunion_motivo = _mensaje OR _existe.sin_reunion_motivo_2 = _mensaje) THEN
    RETURN;
  END IF;

  IF _existe.id IS NULL OR _existe.sin_reunion_motivo IS NULL THEN
    _slot := 1;
  ELSIF _existe.sin_reunion_motivo_2 IS NULL THEN
    _slot := 2;
  ELSE
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.programa_vida_ministerio (
      congregacion_id, fecha_semana, sin_reunion,
      sin_reunion_motivo, sin_reunion_origen_1_id,
      sin_reunion_motivo_2, sin_reunion_origen_2_id,
      presidente_id, cantico_inicial, cantico_intermedio, cantico_final,
      oracion_inicial_id, oracion_final_id, salas_auxiliares_override,
      tesoros, perlas_id, lectura_biblica, maestros,
      encargado_sala_b_id, encargado_sala_c_id, vida_cristiana, estudio_biblico,
      lectura_semana, estado
    )
    VALUES (
      _congregacion_id, _fecha_semana, true,
      CASE WHEN _slot = 1 THEN _mensaje ELSE NULL END, CASE WHEN _slot = 1 THEN _origen_id ELSE NULL END,
      CASE WHEN _slot = 2 THEN _mensaje ELSE NULL END, CASE WHEN _slot = 2 THEN _origen_id ELSE NULL END,
      NULL, NULL, NULL, NULL,
      NULL, NULL, NULL,
      '{"titulo": "", "participante_id": null}'::jsonb, NULL, '{"cita": "", "participante_id": null}'::jsonb, '[]'::jsonb,
      NULL, NULL, '[]'::jsonb, '{"titulo": "", "lector_id": null, "conductor_id": null}'::jsonb,
      NULL, 'borrador'
    )
    ON CONFLICT (congregacion_id, fecha_semana) DO UPDATE SET
      sin_reunion = true,
      sin_reunion_motivo = CASE WHEN _slot = 1 THEN EXCLUDED.sin_reunion_motivo ELSE programa_vida_ministerio.sin_reunion_motivo END,
      sin_reunion_origen_1_id = CASE WHEN _slot = 1 THEN EXCLUDED.sin_reunion_origen_1_id ELSE programa_vida_ministerio.sin_reunion_origen_1_id END,
      sin_reunion_motivo_2 = CASE WHEN _slot = 2 THEN EXCLUDED.sin_reunion_motivo_2 ELSE programa_vida_ministerio.sin_reunion_motivo_2 END,
      sin_reunion_origen_2_id = CASE WHEN _slot = 2 THEN EXCLUDED.sin_reunion_origen_2_id ELSE programa_vida_ministerio.sin_reunion_origen_2_id END,
      presidente_id = NULL,
      cantico_inicial = NULL,
      cantico_intermedio = NULL,
      cantico_final = NULL,
      oracion_inicial_id = NULL,
      oracion_final_id = NULL,
      salas_auxiliares_override = NULL,
      tesoros = EXCLUDED.tesoros,
      perlas_id = NULL,
      lectura_biblica = EXCLUDED.lectura_biblica,
      maestros = EXCLUDED.maestros,
      encargado_sala_b_id = NULL,
      encargado_sala_c_id = NULL,
      vida_cristiana = EXCLUDED.vida_cristiana,
      estudio_biblico = EXCLUDED.estudio_biblico,
      lectura_semana = CASE WHEN _es_conmemoracion THEN NULL ELSE programa_vida_ministerio.lectura_semana END,
      estado = 'borrador';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo aplicar día especial en Vida y Ministerio (semana %): %', _fecha_semana, SQLERRM;
  END;
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
  _es_conmemoracion boolean;
  _es_finde boolean;
BEGIN
  DELETE FROM public.reunion_publica_dias_especiales WHERE origen_dia_especial_id = _id;
  DELETE FROM public.asignaciones_servicio_dias_especiales WHERE origen_dia_especial_id = _id;

  BEGIN
    UPDATE public.programa_vida_ministerio
    SET sin_reunion_motivo = CASE WHEN sin_reunion_origen_1_id = _id THEN NULL ELSE sin_reunion_motivo END,
        sin_reunion_origen_1_id = CASE WHEN sin_reunion_origen_1_id = _id THEN NULL ELSE sin_reunion_origen_1_id END,
        sin_reunion_motivo_2 = CASE WHEN sin_reunion_origen_2_id = _id THEN NULL ELSE sin_reunion_motivo_2 END,
        sin_reunion_origen_2_id = CASE WHEN sin_reunion_origen_2_id = _id THEN NULL ELSE sin_reunion_origen_2_id END
    WHERE sin_reunion_origen_1_id = _id OR sin_reunion_origen_2_id = _id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo limpiar Vida y Ministerio (origen %): %', _id, SQLERRM;
  END;

  BEGIN
    UPDATE public.programa_vida_ministerio
    SET sin_reunion = false
    WHERE sin_reunion = true AND sin_reunion_motivo IS NULL AND sin_reunion_motivo_2 IS NULL
      AND sin_reunion_origen_1_id IS NULL AND sin_reunion_origen_2_id IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo apagar Sin reunión huérfano: %', SQLERRM;
  END;

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

DO $do$
BEGIN
  UPDATE public.dias_especiales SET nombre = nombre WHERE fecha IS NOT NULL AND activo = true;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill omitido: %', SQLERRM;
END;
$do$;
