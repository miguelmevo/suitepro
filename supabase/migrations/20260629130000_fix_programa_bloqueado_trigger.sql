-- Corrige programa_bloqueado para respetar cierre_automatico por módulo y reaberturas manuales
CREATE OR REPLACE FUNCTION public.programa_bloqueado(_congregacion_id uuid, _fecha date, _prog_tipo text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dia_cierre int;
  _cierre_activo boolean;
  _hoy date := CURRENT_DATE;
  _mes_fecha date;
  _mes_hoy date;
  _fue_reabierto boolean := false;
BEGIN
  IF _fecha IS NULL OR _congregacion_id IS NULL THEN RETURN false; END IF;

  _mes_fecha := date_trunc('month', _fecha)::date;
  _mes_hoy   := date_trunc('month', _hoy)::date;

  -- Mes anterior siempre bloqueado
  IF _mes_fecha < _mes_hoy THEN RETURN true; END IF;

  -- Para el mes actual, verificar configuración por módulo
  IF _prog_tipo IS NOT NULL THEN
    SELECT
      COALESCE((valor->>'activo')::boolean, true),
      COALESCE(NULLIF((valor->>'dia')::text, '')::int, 20)
    INTO _cierre_activo, _dia_cierre
    FROM public.configuracion_sistema
    WHERE congregacion_id = _congregacion_id
      AND programa_tipo = _prog_tipo
      AND clave = 'cierre_automatico'
    LIMIT 1;
  END IF;

  -- Fallback a config global
  IF _dia_cierre IS NULL THEN
    SELECT COALESCE(NULLIF((valor->>'dia')::text, '')::int, 20)
    INTO _dia_cierre
    FROM public.configuracion_sistema
    WHERE congregacion_id = _congregacion_id
      AND programa_tipo = 'general'
      AND clave = 'dia_cierre_programas'
    LIMIT 1;
  END IF;
  IF _dia_cierre IS NULL THEN _dia_cierre := 20; END IF;
  IF _cierre_activo IS NULL THEN _cierre_activo := true; END IF;

  -- Si cierre automático desactivado, no bloquear
  IF NOT _cierre_activo THEN RETURN false; END IF;

  -- Si fue reabierto manualmente por admin, no bloquear
  IF _prog_tipo IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.programas_publicados
      WHERE congregacion_id = _congregacion_id
        AND tipo_programa = _prog_tipo
        AND fecha_inicio <= _fecha
        AND fecha_fin >= _fecha
        AND cerrado = false
        AND fecha_cierre IS NOT NULL
    ) INTO _fue_reabierto;
    IF _fue_reabierto THEN RETURN false; END IF;
  END IF;

  IF _mes_fecha = _mes_hoy AND EXTRACT(DAY FROM _hoy)::int >= _dia_cierre THEN
    RETURN true;
  END IF;

  RETURN false;
END; $$;

-- Actualizar trigger para pasar el tipo de programa
CREATE OR REPLACE FUNCTION public.enforce_programa_bloqueado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _fecha date;
  _cong uuid;
  _prog_tipo text;
BEGIN
  IF public.is_super_admin(auth.uid()) THEN RETURN COALESCE(NEW, OLD); END IF;

  _prog_tipo := CASE TG_TABLE_NAME
    WHEN 'programa_asignaciones_servicio' THEN 'asignaciones'
    WHEN 'programa_vida_ministerio'       THEN 'vida_ministerio'
    WHEN 'programa_reunion_publica'       THEN 'reunion_publica'
    WHEN 'programa_predicacion'           THEN 'predicacion'
    ELSE NULL
  END;

  IF TG_TABLE_NAME = 'programa_vida_ministerio' THEN
    _fecha := COALESCE((NEW).fecha_semana, (OLD).fecha_semana);
  ELSE
    _fecha := COALESCE((NEW).fecha, (OLD).fecha);
  END IF;
  _cong := COALESCE((NEW).congregacion_id, (OLD).congregacion_id);

  IF public.programa_bloqueado(_cong, _fecha, _prog_tipo) THEN
    RAISE EXCEPTION 'programa_cerrado' USING HINT = 'Este programa está cerrado. Solo super_admin puede modificarlo.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
