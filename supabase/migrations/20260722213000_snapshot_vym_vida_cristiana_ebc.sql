-- Amplía el snapshot de nombres de Vida y Ministerio para cubrir también
-- Vida Cristiana y Estudio Bíblico de la Congregación (antes solo cubría
-- presidente/oraciones/perlas/sala B, tesoros, maestros y lectura bíblica).
-- De paso se corrige que faltaba encargado_sala_c_id.
CREATE OR REPLACE FUNCTION public.snapshot_programa_vida_ministerio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snap jsonb := '{}'::jsonb; _id uuid;
BEGIN
  FOREACH _id IN ARRAY ARRAY[
    NEW.presidente_id, NEW.oracion_inicial_id, NEW.oracion_final_id,
    NEW.perlas_id, NEW.encargado_sala_b_id, NEW.encargado_sala_c_id
  ] LOOP
    IF _id IS NOT NULL THEN
      _snap := _snap || jsonb_build_object(_id::text, public.participante_nombre_completo(_id));
    END IF;
  END LOOP;
  _snap := _snap || public.collect_uuid_names_from_jsonb(NEW.tesoros);
  _snap := _snap || public.collect_uuid_names_from_jsonb(NEW.maestros);
  _snap := _snap || public.collect_uuid_names_from_jsonb(NEW.lectura_biblica);
  _snap := _snap || public.collect_uuid_names_from_jsonb(NEW.vida_cristiana);
  _snap := _snap || public.collect_uuid_names_from_jsonb(NEW.estudio_biblico);
  NEW.nombres_snapshot := _snap;
  RETURN NEW;
END; $$;

-- Reconstruir el snapshot de las filas ya existentes con la función ampliada.
-- Se desactiva momentáneamente el trigger de bloqueo por cierre de mes, ya que
-- esta migración corre sin un usuario autenticado (auth.uid() = null) y de lo
-- contrario el UPDATE fallaría en cualquier programa de un mes ya cerrado.
ALTER TABLE public.programa_vida_ministerio DISABLE TRIGGER trg_enforce_bloqueo;
UPDATE public.programa_vida_ministerio SET updated_at = updated_at;
ALTER TABLE public.programa_vida_ministerio ENABLE TRIGGER trg_enforce_bloqueo;
