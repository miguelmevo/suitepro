-- Cron autónomo que llama a la Edge Function sync-plantillas-vym cada 2 semanas
-- (lunes por medio, según la paridad de la semana ISO) para rellenar huecos y
-- detectar actualizaciones de contenido en wol.jw.org.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Wrapper: pg_cron no soporta "cada 2 semanas" de forma nativa, así que se programa
-- semanal y el wrapper solo dispara la llamada real en semanas ISO pares.
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
    RETURN; -- semana impar: se salta, corre cada 2 semanas
  END IF;

  PERFORM extensions.net_http_post_wrapper();
END;
$$;

-- net.http_post no puede usarse a través de SECURITY DEFINER sin el schema explícito;
-- se define una función intermedia simple en el schema extensions para el POST real.
CREATE OR REPLACE FUNCTION extensions.net_http_post_wrapper()
RETURNS void
LANGUAGE sql
AS $$
  SELECT net.http_post(
    url := 'https://sfgnveuwitsaiflqjdsc.supabase.co/functions/v1/sync-plantillas-vym',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'c3e803cf6629501a55e4644ff3b8556fb2509a94aa998390'
    ),
    body := '{}'::jsonb
  );
$$;

SELECT cron.schedule(
  'sync-plantillas-vym-quincenal',
  '0 6 * * 1', -- todos los lunes 06:00 UTC (el wrapper filtra a semanas pares)
  $$SELECT public.trigger_sync_plantillas_vym();$$
);
