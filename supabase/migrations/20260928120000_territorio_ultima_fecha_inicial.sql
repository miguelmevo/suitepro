-- S-13: fecha en que se completó cada territorio según el formulario anterior
-- (en papel). Se usa en la columna "Última fecha en que se completó" mientras el
-- sistema no tenga un ciclo completado antes del período impreso.
ALTER TABLE public.territorios
  ADD COLUMN IF NOT EXISTS ultima_fecha_completado_inicial date;

-- Guardar o borrar (NULL) la fecha. Solo quien puede crear/editar el historial de
-- territorios; no puede ser futura ni posterior al inicio del primer ciclo.
CREATE OR REPLACE FUNCTION public.guardar_fecha_inicial_territorio(_territorio_id uuid, _fecha date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cong uuid;
  _primer_inicio date;
BEGIN
  SELECT congregacion_id INTO _cong FROM public.territorios WHERE id = _territorio_id;
  IF _cong IS NULL THEN
    RAISE EXCEPTION 'territorio_no_encontrado';
  END IF;

  IF NOT (
    public.has_permission(auth.uid(), _cong, 'predicacion_territorios_historial', 'crear')
    OR public.has_permission(auth.uid(), _cong, 'predicacion_territorios_historial', 'editar')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _fecha IS NOT NULL THEN
    IF _fecha > CURRENT_DATE THEN
      RAISE EXCEPTION 'fecha_futura';
    END IF;
    SELECT MIN(fecha_inicio) INTO _primer_inicio FROM public.ciclos_territorio WHERE territorio_id = _territorio_id;
    IF _primer_inicio IS NOT NULL AND _fecha > _primer_inicio THEN
      RAISE EXCEPTION 'fecha_posterior_al_primer_ciclo';
    END IF;
  END IF;

  UPDATE public.territorios SET ultima_fecha_completado_inicial = _fecha WHERE id = _territorio_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_fecha_inicial_territorio(uuid, date) TO authenticated;
