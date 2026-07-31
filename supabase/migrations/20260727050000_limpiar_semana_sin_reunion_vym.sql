-- Al auto-aplicar "Sin reunión" en Vida y Ministerio, además de marcar el
-- motivo, se limpian los datos de esa semana (Presidente, tesoros, lectura
-- bíblica de Tesoros, maestros, vida cristiana, estudio bíblico, etc.), ya
-- que no habrá reunión. "Lectura Bíblica de la Semana" (lectura_semana, el
-- texto informativo tipo "Jeremías 32, 33") se conserva siempre — salvo
-- cuando el motivo es la semana de Conmemoración, caso en el que tampoco
-- aplica ninguna lectura semanal.
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
END;
$function$;

-- Backfill: recalcula las entradas activas con fecha para que las semanas
-- ya marcadas "sin reunión" queden limpias con esta nueva lógica.
UPDATE public.dias_especiales SET nombre = nombre WHERE fecha IS NOT NULL AND activo = true;
