-- Elimina automáticamente los programas publicados del mes que acaba de concluir,
-- el último día de cada mes a las 23:59 (hora de Chile), replicando el mismo
-- efecto que el botón manual "Eliminar" (borra el PDF del storage y la fila de
-- programas_publicados). Se ejecuta cada 15 minutos y solo actúa dentro de los
-- últimos 15 minutos del día en hora de Chile, para no depender de un offset UTC
-- fijo (evita problemas con el cambio de horario de verano).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.despublicar_programas_mes_concluido()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ahora_cl timestamp;
  _hoy_cl date;
  _r record;
BEGIN
  _ahora_cl := now() AT TIME ZONE 'America/Santiago';
  IF _ahora_cl::time < '23:45:00' THEN
    RETURN;
  END IF;
  _hoy_cl := _ahora_cl::date;

  FOR _r IN
    SELECT id, pdf_path FROM public.programas_publicados
    WHERE activo = true AND fecha_fin = _hoy_cl
  LOOP
    DELETE FROM storage.objects WHERE bucket_id = 'programas-pdf' AND name = _r.pdf_path;
    DELETE FROM public.programas_publicados WHERE id = _r.id;
  END LOOP;
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'despublicar-mes-concluido';

SELECT cron.schedule(
  'despublicar-mes-concluido',
  '*/15 * * * *',
  $$ SELECT public.despublicar_programas_mes_concluido(); $$
);
