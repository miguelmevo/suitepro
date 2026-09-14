-- Corrige las funciones creadas en 20260914151500 para leer el secret
-- de cron desde Supabase Vault en vez de un literal hardcodeado (el que
-- había en la versión original de esa migración nunca llegó a git).

CREATE OR REPLACE FUNCTION public.cron_secret_notificaciones()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_notificaciones';
$$;

CREATE OR REPLACE FUNCTION public.notificar_nuevo_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mostrar_en_inicio IS TRUE THEN
    PERFORM net.http_post(
      url := 'https://sfgnveuwitsaiflqjdsc.supabase.co/functions/v1/notificar-categoria',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', public.cron_secret_notificaciones()
      ),
      body := jsonb_build_object(
        'congregacionId', NEW.congregacion_id,
        'categoria', 'eventos',
        'title', 'Nuevo evento',
        'body', NEW.nombre
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notificar_programa_publicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _categoria text;
BEGIN
  _categoria := CASE NEW.tipo_programa
    WHEN 'predicacion' THEN 'predicacion'
    WHEN 'vida_ministerio' THEN 'vida_ministerio'
    WHEN 'asignaciones_servicio' THEN 'servicio'
    WHEN 'reunion_publica' THEN 'servicio'
    ELSE NULL
  END;

  IF _categoria IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://sfgnveuwitsaiflqjdsc.supabase.co/functions/v1/notificar-categoria',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret_notificaciones()
    ),
    body := jsonb_build_object(
      'congregacionId', NEW.congregacion_id,
      'categoria', _categoria,
      'title', 'Nuevo programa publicado',
      'body', 'Se publicó el programa: ' || NEW.periodo
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION extensions.trigger_recordatorio_asignaciones_diario()
RETURNS void
LANGUAGE sql
AS $$
  SELECT net.http_post(
    url := 'https://sfgnveuwitsaiflqjdsc.supabase.co/functions/v1/recordatorio-asignaciones-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret_notificaciones()
    ),
    body := '{}'::jsonb
  );
$$;
