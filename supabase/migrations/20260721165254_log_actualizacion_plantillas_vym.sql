-- Log de actualizaciones automáticas del cron de sincronización de plantillas VyM.
-- Solo se inserta una fila cuando el cron detecta que una plantilla YA existente
-- cambió de contenido respecto a lo que había (no en creaciones nuevas ni cuando
-- no hay diferencia), para que quede visible qué cambió y cuándo.

CREATE TABLE public.log_actualizacion_plantillas_vym (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_semana date NOT NULL,
  fecha_ejecucion timestamptz NOT NULL DEFAULT now(),
  url_origen text,
  cambios jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_log_actualizacion_plantillas_vym_fecha_semana
  ON public.log_actualizacion_plantillas_vym (fecha_semana DESC);

CREATE INDEX idx_log_actualizacion_plantillas_vym_fecha_ejecucion
  ON public.log_actualizacion_plantillas_vym (fecha_ejecucion DESC);

ALTER TABLE public.log_actualizacion_plantillas_vym ENABLE ROW LEVEL SECURITY;

-- Mismo criterio que plantillas_vida_ministerio_oficial: lectura abierta a
-- cualquier usuario autenticado (es contenido global, no por congregación).
-- La escritura la hace únicamente la Edge Function con la service role key,
-- que no pasa por RLS, así que no se necesita policy de INSERT/UPDATE/DELETE.
CREATE POLICY "Cualquier autenticado puede ver el log de actualizaciones"
  ON public.log_actualizacion_plantillas_vym
  FOR SELECT
  TO authenticated
  USING (true);
