-- Mueve el "auto-aplicado" de días especiales (Ajustes → Días Especiales)
-- del navegador a la base de datos, vía trigger. Antes, cada programa
-- (Reunión Pública / Asignaciones de Servicio) tenía un efecto de React que,
-- al abrir el mes, revisaba y corregía lo aplicado — esto causaba demoras
-- visibles (~5s) y, al editar la fecha de una entrada, el resultado viejo
-- podía quedar "pegado" si esa página no volvía a cargarse. Con el trigger,
-- el resultado queda correcto en la base de datos desde el momento en que
-- se guarda el cambio en Ajustes, sin depender de qué programa esté abierto.

-- Dado _fecha (cualquier día) y el nombre de un día de la semana
-- ('domingo'..'sabado'), devuelve la fecha de ESE día dentro de la misma
-- semana (lunes a domingo) que contiene _fecha.
CREATE OR REPLACE FUNCTION public.fecha_reunion_en_semana(_fecha date, _dia_semana_nombre text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _dow_map CONSTANT jsonb := '{"domingo":0,"lunes":1,"martes":2,"miercoles":3,"jueves":4,"viernes":5,"sabado":6}'::jsonb;
  _target_dow int := COALESCE((_dow_map ->> lower(coalesce(_dia_semana_nombre, 'domingo')))::int, 0);
  _fecha_dow int := EXTRACT(DOW FROM _fecha)::int;
  _dias_desde_lunes int := (_fecha_dow + 6) % 7;
  _lunes date := _fecha - _dias_desde_lunes;
  _offset int := (_target_dow + 6) % 7;
BEGIN
  RETURN _lunes + _offset;
END;
$function$;

-- Aplica (o actualiza) un día especial en la primera fila libre (slot 1 o 2)
-- de la tabla indicada para esa fecha, sin pisar lo que un usuario haya
-- marcado a mano (respeta slots ya ocupados por cualquier origen).
CREATE OR REPLACE FUNCTION public.aplicar_slot_dia_especial(
  _tabla text, _congregacion_id uuid, _fecha date, _mensaje text, _color text, _origen_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _slot1_ocupado boolean;
  _slot2_ocupado boolean;
  _slot int;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE congregacion_id = $1 AND fecha = $2 AND slot = 1)', _tabla)
    INTO _slot1_ocupado USING _congregacion_id, _fecha;

  IF NOT _slot1_ocupado THEN
    _slot := 1;
  ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE congregacion_id = $1 AND fecha = $2 AND slot = 2)', _tabla)
      INTO _slot2_ocupado USING _congregacion_id, _fecha;
    IF NOT _slot2_ocupado THEN
      _slot := 2;
    ELSE
      RETURN;
    END IF;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I (congregacion_id, fecha, slot, mensaje, color, color_pdf, origen_dia_especial_id)
     VALUES ($1, $2, $3, $4, $5, NULL, $6)
     ON CONFLICT (congregacion_id, fecha, slot) DO UPDATE
       SET mensaje = EXCLUDED.mensaje, color = EXCLUDED.color, origen_dia_especial_id = EXCLUDED.origen_dia_especial_id',
    _tabla
  ) USING _congregacion_id, _fecha, _slot, _mensaje, _color, _origen_id;
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
BEGIN
  -- Limpia lo que ya estaba aplicado desde esta entrada; se recalcula
  -- abajo si corresponde. Esto también cubre ediciones de fecha/motivo/
  -- programas y el caso "se desactivó" (soft delete).
  DELETE FROM public.reunion_publica_dias_especiales WHERE origen_dia_especial_id = _id;
  DELETE FROM public.asignaciones_servicio_dias_especiales WHERE origen_dia_especial_id = _id;

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

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_aplicar_dia_especial ON public.dias_especiales;
CREATE TRIGGER trg_aplicar_dia_especial
AFTER INSERT OR UPDATE OR DELETE ON public.dias_especiales
FOR EACH ROW
EXECUTE FUNCTION public.aplicar_dia_especial_a_programas();

-- Backfill: fuerza el trigger para las entradas ya existentes con fecha,
-- para que queden correctamente aplicadas sin esperar la próxima edición.
UPDATE public.dias_especiales SET nombre = nombre WHERE fecha IS NOT NULL AND activo = true;
