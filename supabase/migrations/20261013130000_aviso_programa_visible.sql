-- El aviso "Nuevo programa publicado" (y el aviso personal con las asignaciones de cada
-- persona) se envía cuando el programa se hace VISIBLE, no al pulsar Publicar:
--  * mes en curso: al publicar;
--  * mes siguiente: el día de "publicación anticipada" configurado en los ajustes.
-- La función avisar-programa-publicado decide si ya es visible; una tarea diaria revisa
-- los pendientes. Cada programa se avisa una sola vez (aviso_enviado_at).

ALTER TABLE public.programas_publicados
  ADD COLUMN IF NOT EXISTS aviso_enviado_at timestamptz;

-- Lo ya publicado no se vuelve a avisar.
UPDATE public.programas_publicados
SET aviso_enviado_at = COALESCE(created_at, now())
WHERE aviso_enviado_at IS NULL;

-- Volver a publicar (cambios) el mismo periodo no repite el aviso: la fila nueva hereda
-- la marca de la anterior si ya se había avisado.
CREATE OR REPLACE FUNCTION public.heredar_aviso_programa_publicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aviso_enviado_at IS NULL THEN
    SELECT p.aviso_enviado_at INTO NEW.aviso_enviado_at
    FROM public.programas_publicados p
    WHERE p.congregacion_id = NEW.congregacion_id
      AND p.tipo_programa = NEW.tipo_programa
      AND p.fecha_inicio = NEW.fecha_inicio
      AND p.id <> NEW.id
      AND p.aviso_enviado_at IS NOT NULL
    ORDER BY p.aviso_enviado_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_heredar_aviso_programa_publicado ON public.programas_publicados;
CREATE TRIGGER trg_heredar_aviso_programa_publicado
  BEFORE INSERT ON public.programas_publicados
  FOR EACH ROW EXECUTE FUNCTION public.heredar_aviso_programa_publicado();

-- Al publicar: se consulta a la función, que avisa sólo si el programa ya es visible.
CREATE OR REPLACE FUNCTION public.notificar_programa_publicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aviso_enviado_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://sfgnveuwitsaiflqjdsc.supabase.co/functions/v1/avisar-programa-publicado',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret_notificaciones()
    ),
    body := jsonb_build_object('programaId', NEW.id)
  );
  RETURN NEW;
END;
$$;

-- Tarea diaria (12:00 UTC, mañana en Chile): avisa los programas que ya se hicieron visibles.
CREATE OR REPLACE FUNCTION extensions.trigger_avisar_programas_publicados()
RETURNS void
LANGUAGE sql
AS $$
  SELECT net.http_post(
    url := 'https://sfgnveuwitsaiflqjdsc.supabase.co/functions/v1/avisar-programa-publicado',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret_notificaciones()
    ),
    body := '{}'::jsonb
  );
$$;

SELECT cron.unschedule('avisar-programas-publicados')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'avisar-programas-publicados');
SELECT cron.schedule(
  'avisar-programas-publicados',
  '0 12 * * *',
  $$SELECT extensions.trigger_avisar_programas_publicados();$$
);
