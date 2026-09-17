-- Contraparte PRD de las migraciones de notificaciones que llegaron con
-- URLs de DEV hardcodeadas dentro de las funciones de trigger
-- (20260914151500, 20260914153000, 20260914160000) — mismo patrón ya usado
-- para sync-plantillas-vym: esta migración sobreescribe esas funciones con
-- la URL del proyecto PRD (gjgudujupgbcuqfqncmw) y su propio secret de
-- Vault (cron_secret_notificaciones, distinto al de DEV).

CREATE OR REPLACE FUNCTION public.notificar_nuevo_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mostrar_en_inicio IS TRUE THEN
    PERFORM net.http_post(
      url := 'https://gjgudujupgbcuqfqncmw.supabase.co/functions/v1/notificar-categoria',
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
    WHEN 'predicacion' THEN 'predicacion_programa'
    WHEN 'vida_ministerio' THEN 'vida_ministerio'
    WHEN 'asignaciones_servicio' THEN 'servicio'
    WHEN 'reunion_publica' THEN 'servicio'
    ELSE NULL
  END;

  IF _categoria IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://gjgudujupgbcuqfqncmw.supabase.co/functions/v1/notificar-categoria',
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
    url := 'https://gjgudujupgbcuqfqncmw.supabase.co/functions/v1/recordatorio-asignaciones-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret_notificaciones()
    ),
    body := '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION extensions.trigger_recordatorio_predicacion()
RETURNS void
LANGUAGE sql
AS $$
  SELECT net.http_post(
    url := 'https://gjgudujupgbcuqfqncmw.supabase.co/functions/v1/recordatorio-predicacion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret_notificaciones()
    ),
    body := '{}'::jsonb
  );
$$;
