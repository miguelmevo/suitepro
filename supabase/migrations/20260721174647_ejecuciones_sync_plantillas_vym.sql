-- Agrupa el log de plantillas VyM por "ejecución" (una corrida del sync,
-- automática por cron o manual desde el botón), con un resumen totalizado
-- y el origen, para poder mostrar el log agrupado/colapsable en el admin.

CREATE TABLE public.ejecucion_sync_plantillas_vym (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_ejecucion timestamptz NOT NULL DEFAULT now(),
  origen text NOT NULL CHECK (origen IN ('cron', 'manual')),
  semanas_procesadas integer NOT NULL DEFAULT 0,
  semanas_creadas integer NOT NULL DEFAULT 0,
  semanas_actualizadas integer NOT NULL DEFAULT 0,
  semanas_sin_cambio integer NOT NULL DEFAULT 0,
  semanas_error integer NOT NULL DEFAULT 0,
  detenido_en date
);

CREATE INDEX idx_ejecucion_sync_plantillas_vym_fecha
  ON public.ejecucion_sync_plantillas_vym (fecha_ejecucion DESC);

ALTER TABLE public.ejecucion_sync_plantillas_vym ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier autenticado puede ver las ejecuciones del sync"
  ON public.ejecucion_sync_plantillas_vym
  FOR SELECT
  TO authenticated
  USING (true);

-- El log de cambios pasa a poder referenciar la ejecución que lo generó,
-- y a guardar el estado de esa semana (no solo cuando hubo diff).
ALTER TABLE public.log_actualizacion_plantillas_vym
  ADD COLUMN ejecucion_id uuid REFERENCES public.ejecucion_sync_plantillas_vym(id) ON DELETE CASCADE,
  ADD COLUMN estado text;

CREATE INDEX idx_log_actualizacion_plantillas_vym_ejecucion
  ON public.log_actualizacion_plantillas_vym (ejecucion_id);
