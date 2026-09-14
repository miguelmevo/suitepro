-- Desglosa la categoría "predicacion" en 3 toggles independientes:
--   predicacion_recordatorio     -> aviso al capitán 16h y 1h antes de su salida
--   predicacion_punto_encuentro  -> dónde es el punto de encuentro (junto al aviso de 1h)
--   predicacion_programa        -> se publicó el programa de predicación del mes

ALTER TABLE public.notificacion_preferencias DROP CONSTRAINT notificacion_preferencias_categoria_check;
ALTER TABLE public.notificacion_preferencias ADD CONSTRAINT notificacion_preferencias_categoria_check
  CHECK (categoria IN (
    'predicacion_recordatorio',
    'predicacion_punto_encuentro',
    'predicacion_programa',
    'vida_ministerio',
    'servicio',
    'eventos'
  ));

-- Migrar preferencias ya guardadas con la categoría vieja "predicacion" a las 3 nuevas.
INSERT INTO public.notificacion_preferencias (user_id, categoria, activo)
SELECT user_id, nueva_categoria, activo
FROM public.notificacion_preferencias
CROSS JOIN LATERAL (
  VALUES ('predicacion_recordatorio'), ('predicacion_punto_encuentro'), ('predicacion_programa')
) AS t(nueva_categoria)
WHERE categoria = 'predicacion'
ON CONFLICT (user_id, categoria) DO NOTHING;

DELETE FROM public.notificacion_preferencias WHERE categoria = 'predicacion';

-- Actualizar el trigger de "programa publicado" para usar la nueva categoría.
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

-- Control de idempotencia para no duplicar los avisos de 16h/1h por salida.
ALTER TABLE public.programa_predicacion
  ADD COLUMN IF NOT EXISTS notificado_16h BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificado_1h BOOLEAN NOT NULL DEFAULT false;

-- Cron: revisa cada 30 minutos si hay salidas de predicación a 16h o 1h de
-- distancia y dispara los avisos correspondientes.
CREATE OR REPLACE FUNCTION extensions.trigger_recordatorio_predicacion()
RETURNS void
LANGUAGE sql
AS $$
  SELECT net.http_post(
    url := 'https://sfgnveuwitsaiflqjdsc.supabase.co/functions/v1/recordatorio-predicacion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret_notificaciones()
    ),
    body := '{}'::jsonb
  );
$$;

SELECT cron.schedule(
  'recordatorio-predicacion',
  '*/30 * * * *',
  $$SELECT extensions.trigger_recordatorio_predicacion();$$
);
