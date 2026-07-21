-- Configuración del cron quincenal de sync-plantillas-vym específica del
-- proyecto PRD (gjgudujupgbcuqfqncmw). Es la contraparte de
-- 20260721170655_cron_sync_plantillas_vym.sql (que quedó con los valores de
-- DEV) — se marca esa migración como ya aplicada en PRD sin ejecutarla, y
-- esta se marca como ya aplicada en DEV sin ejecutarla, para que cada
-- ambiente solo dispare su propia función con su propio secreto.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_sync_plantillas_vym()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  semana_iso int;
BEGIN
  semana_iso := extract(week from now())::int;
  IF semana_iso % 2 <> 0 THEN
    RETURN;
  END IF;

  PERFORM extensions.net_http_post_wrapper();
END;
$$;

CREATE OR REPLACE FUNCTION extensions.net_http_post_wrapper()
RETURNS void
LANGUAGE sql
AS $$
  SELECT net.http_post(
    url := 'https://gjgudujupgbcuqfqncmw.supabase.co/functions/v1/sync-plantillas-vym',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'fed98965915f3e436d0622ff5d2a87f75c237435fd5e28bb'
    ),
    body := '{}'::jsonb
  );
$$;

SELECT cron.schedule(
  'sync-plantillas-vym-quincenal',
  '0 6 * * 1',
  $$SELECT public.trigger_sync_plantillas_vym();$$
);
