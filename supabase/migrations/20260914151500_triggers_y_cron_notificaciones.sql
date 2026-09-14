-- Triggers y cron para el sistema de notificaciones push.
-- Reutiliza el patrón ya usado en sync-plantillas-vym (pg_cron + pg_net
-- llamando a Edge Functions), pero el secret compartido NO se hardcodea
-- en esta migración (quedaría en texto plano en el historial de git):
-- se guarda en Supabase Vault ("cron_secret_notificaciones") con un
-- comando aparte que no se versiona, y estas funciones lo leen en runtime.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.cron_secret_notificaciones()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_notificaciones';
$$;

-- Trigger: nuevo "día especial" marcado para mostrar en Inicio -> categoría "eventos".
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

CREATE TRIGGER trg_notificar_nuevo_evento
AFTER INSERT ON public.dias_especiales
FOR EACH ROW
EXECUTE FUNCTION public.notificar_nuevo_evento();

-- Trigger: se publica un programa (predicación / vida y ministerio / servicio)
-- -> notifica a la congregación en la categoría correspondiente.
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

CREATE TRIGGER trg_notificar_programa_publicado
AFTER INSERT ON public.programas_publicados
FOR EACH ROW
EXECUTE FUNCTION public.notificar_programa_publicado();

-- Cron: recordatorio diario al mediodía (hora de Chile) de asignaciones de hoy.
-- 16:00 UTC ≈ mediodía en Chile continental (UTC-4); no ajusta horario de
-- verano automáticamente, igual que el resto de los cron de este proyecto.
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

SELECT cron.schedule(
  'recordatorio-asignaciones-diario',
  '0 16 * * *',
  $$SELECT extensions.trigger_recordatorio_asignaciones_diario();$$
);
