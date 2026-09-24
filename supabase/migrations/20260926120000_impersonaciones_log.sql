-- Auditoría de "entrar como otro usuario": quién, a quién y cuándo.
-- Solo la función impersonar-usuario (service role) inserta; los administradores
-- de la congregación pueden consultar el historial.
CREATE TABLE IF NOT EXISTS public.impersonaciones_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_id uuid NOT NULL,
  congregacion_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.impersonaciones_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins de la congregación ven las impersonaciones"
ON public.impersonaciones_log FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'ver'));

CREATE INDEX IF NOT EXISTS impersonaciones_log_cong_idx
  ON public.impersonaciones_log (congregacion_id, created_at DESC);
