-- Migra a Supabase Vault el secret de sync-plantillas-vym que había quedado
-- hardcodeado en texto plano en 20260721195146_cron_sync_plantillas_vym_prd.sql
-- (ya expuesto en el historial de git). El valor se rotó (ya no es el mismo
-- que quedó en el historial) y se guardó en Vault con un comando aparte que
-- no se versiona; esta función solo lee el valor vigente en runtime.
-- Contraparte PRD de 20260914154500_migrar_secret_sync_vym_a_vault.sql (DEV).

CREATE OR REPLACE FUNCTION public.cron_sync_secret_vym()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_sync_secret_vym';
$$;

CREATE OR REPLACE FUNCTION extensions.net_http_post_wrapper()
RETURNS void
LANGUAGE sql
AS $$
  SELECT net.http_post(
    url := 'https://gjgudujupgbcuqfqncmw.supabase.co/functions/v1/sync-plantillas-vym',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_sync_secret_vym()
    ),
    body := '{}'::jsonb
  );
$$;
