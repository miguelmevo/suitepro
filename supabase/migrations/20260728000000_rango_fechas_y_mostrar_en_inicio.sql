-- Permite que un día especial cubra un rango corto de fechas dentro de la
-- misma semana (ej.: una Asamblea viernes-domingo), y agrega un toggle
-- independiente de "Aplica a" para decidir si esa entrada se muestra en la
-- tarjeta "Eventos" de Inicio.
ALTER TABLE public.dias_especiales
  ADD COLUMN fecha_fin date,
  ADD COLUMN mostrar_en_inicio boolean NOT NULL DEFAULT false;

-- fecha_fin, si existe, no puede ser anterior a fecha ni cruzar de semana
-- (se valida en el formulario; a nivel de datos solo se exige el orden).
ALTER TABLE public.dias_especiales
  ADD CONSTRAINT dias_especiales_fecha_fin_check CHECK (fecha_fin IS NULL OR fecha_fin >= fecha);

-- El índice único de auto-aplicado (congregacion_id, fecha) ya no alcanza
-- ahora que una entrada puede cubrir varias fechas; se recrea sin esa
-- restricción (la prevención de motivos duplicados en la misma fecha ya no
-- es necesaria: dentro de una semana ahora se permiten hasta 2 motivos por
-- reunión mediante los slots, igual que el resto del sistema).
DROP INDEX IF EXISTS public.dias_especiales_fecha_unique;

-- Todas las funciones que dependen de una sola "fecha" ahora recorren el
-- rango [fecha, COALESCE(fecha_fin, fecha)] día por día (a lo más ~7 días,
-- no cruza semana) y aplican sobre cada reunión real encontrada en ese
-- rango, sin duplicar si ya está aplicada.
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
  _fecha_fin date;
  _dia date;
  _fecha_rp date;
  _fecha_asig_entre date;
  _fecha_asig_fin date;
  _lunes_semana_vym date;
  _es_conmemoracion boolean;
  _es_finde boolean;
  _rp_hechas date[] := '{}';
  _asig_hechas date[] := '{}';
  _vym_hechas date[] := '{}';
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
  _fecha_fin := COALESCE(NEW.fecha_fin, NEW.fecha);

  _dia := NEW.fecha;
  WHILE _dia <= _fecha_fin LOOP
    _es_finde := EXTRACT(DOW FROM _dia)::int IN (0, 6);

    IF _es_conmemoracion THEN
      IF NOT _es_finde THEN
        IF 'vida_ministerio' = ANY(NEW.programas) THEN
          _lunes_semana_vym := _dia - ((EXTRACT(DOW FROM _dia)::int + 6) % 7);
          IF NOT (_lunes_semana_vym = ANY(_vym_hechas)) THEN
            PERFORM public.aplicar_sin_reunion_vym(NEW.congregacion_id, _lunes_semana_vym, NEW.nombre, NEW.id);
            _vym_hechas := array_append(_vym_hechas, _lunes_semana_vym);
          END IF;
        END IF;
        IF 'asignaciones_servicio' = ANY(NEW.programas) THEN
          _fecha_asig_entre := public.fecha_reunion_en_semana(_dia, _dia_entre_semana);
          IF NOT (_fecha_asig_entre = ANY(_asig_hechas)) THEN
            PERFORM public.aplicar_slot_dia_especial('asignaciones_servicio_dias_especiales', NEW.congregacion_id, _fecha_asig_entre, NEW.nombre, NEW.color, NEW.id);
            _asig_hechas := array_append(_asig_hechas, _fecha_asig_entre);
          END IF;
        END IF;
      ELSE
        IF 'reunion_publica' = ANY(NEW.programas) THEN
          _fecha_rp := public.fecha_reunion_en_semana(_dia, _dia_fin_semana);
          IF NOT (_fecha_rp = ANY(_rp_hechas)) THEN
            PERFORM public.aplicar_slot_dia_especial('reunion_publica_dias_especiales', NEW.congregacion_id, _fecha_rp, NEW.nombre, NEW.color, NEW.id);
            _rp_hechas := array_append(_rp_hechas, _fecha_rp);
          END IF;
        END IF;
        IF 'asignaciones_servicio' = ANY(NEW.programas) THEN
          _fecha_asig_fin := public.fecha_reunion_en_semana(_dia, _dia_fin_semana);
          IF NOT (_fecha_asig_fin = ANY(_asig_hechas)) THEN
            PERFORM public.aplicar_slot_dia_especial('asignaciones_servicio_dias_especiales', NEW.congregacion_id, _fecha_asig_fin, NEW.nombre, NEW.color, NEW.id);
            _asig_hechas := array_append(_asig_hechas, _fecha_asig_fin);
          END IF;
        END IF;
      END IF;
    ELSE
      IF 'reunion_publica' = ANY(NEW.programas) THEN
        _fecha_rp := public.fecha_reunion_en_semana(_dia, _dia_fin_semana);
        IF NOT (_fecha_rp = ANY(_rp_hechas)) THEN
          PERFORM public.aplicar_slot_dia_especial('reunion_publica_dias_especiales', NEW.congregacion_id, _fecha_rp, NEW.nombre, NEW.color, NEW.id);
          _rp_hechas := array_append(_rp_hechas, _fecha_rp);
        END IF;
      END IF;

      IF 'asignaciones_servicio' = ANY(NEW.programas) THEN
        _fecha_asig_entre := public.fecha_reunion_en_semana(_dia, _dia_entre_semana);
        _fecha_asig_fin := public.fecha_reunion_en_semana(_dia, _dia_fin_semana);
        IF NOT (_fecha_asig_entre = ANY(_asig_hechas)) THEN
          PERFORM public.aplicar_slot_dia_especial('asignaciones_servicio_dias_especiales', NEW.congregacion_id, _fecha_asig_entre, NEW.nombre, NEW.color, NEW.id);
          _asig_hechas := array_append(_asig_hechas, _fecha_asig_entre);
        END IF;
        IF NOT (_fecha_asig_fin = ANY(_asig_hechas)) THEN
          PERFORM public.aplicar_slot_dia_especial('asignaciones_servicio_dias_especiales', NEW.congregacion_id, _fecha_asig_fin, NEW.nombre, NEW.color, NEW.id);
          _asig_hechas := array_append(_asig_hechas, _fecha_asig_fin);
        END IF;
      END IF;

      IF 'vida_ministerio' = ANY(NEW.programas) THEN
        _lunes_semana_vym := _dia - ((EXTRACT(DOW FROM _dia)::int + 6) % 7);
        IF NOT (_lunes_semana_vym = ANY(_vym_hechas)) THEN
          PERFORM public.aplicar_sin_reunion_vym(NEW.congregacion_id, _lunes_semana_vym, NEW.nombre, NEW.id);
          _vym_hechas := array_append(_vym_hechas, _lunes_semana_vym);
        END IF;
      END IF;
    END IF;

    _dia := _dia + 1;
  END LOOP;

  RETURN NEW;
END;
$function$;
