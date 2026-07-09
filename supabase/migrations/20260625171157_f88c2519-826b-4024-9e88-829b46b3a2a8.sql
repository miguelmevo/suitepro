
CREATE OR REPLACE FUNCTION public.programa_bloqueado(_congregacion_id uuid, _fecha date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _dia_cierre int; _hoy date := CURRENT_DATE; _mes_fecha date; _mes_hoy date;
BEGIN
  IF _fecha IS NULL OR _congregacion_id IS NULL THEN RETURN false; END IF;
  SELECT COALESCE(NULLIF((valor->>'dia')::text,'')::int, 20) INTO _dia_cierre
  FROM public.configuracion_sistema
  WHERE congregacion_id = _congregacion_id AND programa_tipo='general' AND clave='dia_cierre_programas' LIMIT 1;
  IF _dia_cierre IS NULL THEN _dia_cierre := 20; END IF;
  _mes_fecha := date_trunc('month', _fecha)::date;
  _mes_hoy   := date_trunc('month', _hoy)::date;
  IF _mes_fecha < _mes_hoy THEN RETURN true; END IF;
  IF _mes_fecha = _mes_hoy AND EXTRACT(DAY FROM _hoy)::int >= _dia_cierre THEN RETURN true; END IF;
  RETURN false;
END; $$;

ALTER TABLE public.programa_predicacion           ADD COLUMN IF NOT EXISTS nombres_snapshot jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.programa_vida_ministerio       ADD COLUMN IF NOT EXISTS nombres_snapshot jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.programa_reunion_publica       ADD COLUMN IF NOT EXISTS nombres_snapshot jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.programa_asignaciones_servicio ADD COLUMN IF NOT EXISTS nombres_snapshot jsonb DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.participante_nombre_completo(_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT TRIM(COALESCE(nombre,'') || ' ' || COALESCE(apellido,'')) FROM public.participantes WHERE id = _id;
$$;

CREATE OR REPLACE FUNCTION public.snapshot_programa_predicacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snap jsonb := '{}'::jsonb; _ag jsonb; _cap_id uuid;
BEGIN
  IF NEW.capitan_id IS NOT NULL THEN
    _snap := _snap || jsonb_build_object(NEW.capitan_id::text, public.participante_nombre_completo(NEW.capitan_id));
  END IF;
  IF NEW.asignaciones_grupos IS NOT NULL AND jsonb_typeof(NEW.asignaciones_grupos)='array' THEN
    FOR _ag IN SELECT jsonb_array_elements(NEW.asignaciones_grupos) LOOP
      _cap_id := NULLIF(_ag->>'capitan_id','')::uuid;
      IF _cap_id IS NOT NULL THEN
        _snap := _snap || jsonb_build_object(_cap_id::text, public.participante_nombre_completo(_cap_id));
      END IF;
    END LOOP;
  END IF;
  NEW.nombres_snapshot := _snap;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.snapshot_programa_reunion_publica()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snap jsonb := '{}'::jsonb; _ids uuid[]; _id uuid;
BEGIN
  _ids := ARRAY[NEW.presidente_id, NEW.orador_id, NEW.orador_suplente_id, NEW.orador_saliente_id, NEW.conductor_atalaya_id, NEW.lector_atalaya_id];
  FOREACH _id IN ARRAY _ids LOOP
    IF _id IS NOT NULL THEN
      _snap := _snap || jsonb_build_object(_id::text, public.participante_nombre_completo(_id));
    END IF;
  END LOOP;
  NEW.nombres_snapshot := _snap;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.snapshot_programa_asig_servicio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snap jsonb := '{}'::jsonb;
BEGIN
  IF NEW.participante_id IS NOT NULL THEN
    _snap := jsonb_build_object(NEW.participante_id::text, public.participante_nombre_completo(NEW.participante_id));
  END IF;
  NEW.nombres_snapshot := _snap;
  RETURN NEW;
END; $$;

-- Helper recursivo: recorre cualquier jsonb buscando claves *_id que sean uuid
CREATE OR REPLACE FUNCTION public.collect_uuid_names_from_jsonb(_data jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb := '{}'::jsonb; _key text; _val jsonb; _id uuid;
BEGIN
  IF _data IS NULL THEN RETURN _result; END IF;
  IF jsonb_typeof(_data) = 'object' THEN
    FOR _key, _val IN SELECT * FROM jsonb_each(_data) LOOP
      IF jsonb_typeof(_val) IN ('object','array') THEN
        _result := _result || public.collect_uuid_names_from_jsonb(_val);
      ELSIF _key LIKE '%\_id' ESCAPE '\' AND jsonb_typeof(_val)='string' THEN
        BEGIN
          _id := NULLIF(_val#>>'{}','')::uuid;
          IF _id IS NOT NULL THEN
            _result := _result || jsonb_build_object(_id::text, public.participante_nombre_completo(_id));
          END IF;
        EXCEPTION WHEN others THEN NULL; END;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(_data) = 'array' THEN
    FOR _val IN SELECT jsonb_array_elements(_data) LOOP
      _result := _result || public.collect_uuid_names_from_jsonb(_val);
    END LOOP;
  END IF;
  RETURN _result;
END; $$;

CREATE OR REPLACE FUNCTION public.snapshot_programa_vida_ministerio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snap jsonb := '{}'::jsonb; _id uuid;
BEGIN
  FOREACH _id IN ARRAY ARRAY[NEW.presidente_id, NEW.oracion_inicial_id, NEW.oracion_final_id, NEW.perlas_id, NEW.encargado_sala_b_id] LOOP
    IF _id IS NOT NULL THEN
      _snap := _snap || jsonb_build_object(_id::text, public.participante_nombre_completo(_id));
    END IF;
  END LOOP;
  _snap := _snap || public.collect_uuid_names_from_jsonb(NEW.tesoros);
  _snap := _snap || public.collect_uuid_names_from_jsonb(NEW.maestros);
  _snap := _snap || public.collect_uuid_names_from_jsonb(NEW.lectura_biblica);
  NEW.nombres_snapshot := _snap;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_snapshot_predicacion ON public.programa_predicacion;
CREATE TRIGGER trg_snapshot_predicacion BEFORE INSERT OR UPDATE ON public.programa_predicacion
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_programa_predicacion();
DROP TRIGGER IF EXISTS trg_snapshot_reunion_publica ON public.programa_reunion_publica;
CREATE TRIGGER trg_snapshot_reunion_publica BEFORE INSERT OR UPDATE ON public.programa_reunion_publica
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_programa_reunion_publica();
DROP TRIGGER IF EXISTS trg_snapshot_asig_servicio ON public.programa_asignaciones_servicio;
CREATE TRIGGER trg_snapshot_asig_servicio BEFORE INSERT OR UPDATE ON public.programa_asignaciones_servicio
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_programa_asig_servicio();
DROP TRIGGER IF EXISTS trg_snapshot_vida_ministerio ON public.programa_vida_ministerio;
CREATE TRIGGER trg_snapshot_vida_ministerio BEFORE INSERT OR UPDATE ON public.programa_vida_ministerio
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_programa_vida_ministerio();

UPDATE public.programa_predicacion SET updated_at = updated_at;
UPDATE public.programa_reunion_publica SET updated_at = updated_at;
UPDATE public.programa_asignaciones_servicio SET updated_at = updated_at;
UPDATE public.programa_vida_ministerio SET updated_at = updated_at;

CREATE OR REPLACE FUNCTION public.enforce_programa_bloqueado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _fecha date; _cong uuid;
BEGIN
  IF public.is_super_admin(auth.uid()) THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'programa_vida_ministerio' THEN
    _fecha := COALESCE((NEW).fecha_semana, (OLD).fecha_semana);
  ELSE
    _fecha := COALESCE((NEW).fecha, (OLD).fecha);
  END IF;
  _cong := COALESCE((NEW).congregacion_id, (OLD).congregacion_id);
  IF public.programa_bloqueado(_cong, _fecha) THEN
    RAISE EXCEPTION 'programa_cerrado' USING HINT = 'Este programa está cerrado. Solo super_admin puede modificarlo.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['programa_predicacion','programa_vida_ministerio','programa_reunion_publica','programa_asignaciones_servicio'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_bloqueo ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_enforce_bloqueo BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_programa_bloqueado()', t);
  END LOOP;
END $$;
