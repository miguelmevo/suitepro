CREATE TABLE IF NOT EXISTS public.asignaciones_servicio_dias_especiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregacion_id uuid NOT NULL,
  fecha date NOT NULL,
  mensaje text NOT NULL,
  color text NOT NULL DEFAULT '#1e3a5f',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asig_serv_dias_esp_unique UNIQUE (congregacion_id, fecha)
);

ALTER TABLE public.asignaciones_servicio_dias_especiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven dias esp asig servicio de su congr"
  ON public.asignaciones_servicio_dias_especiales
  FOR SELECT
  USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Editores asig servicio insertan dias esp"
  ON public.asignaciones_servicio_dias_especiales
  FOR INSERT
  WITH CHECK (can_edit_asignaciones_servicio(congregacion_id));

CREATE POLICY "Editores asig servicio actualizan dias esp"
  ON public.asignaciones_servicio_dias_especiales
  FOR UPDATE
  USING (can_edit_asignaciones_servicio(congregacion_id));

CREATE POLICY "Editores asig servicio eliminan dias esp"
  ON public.asignaciones_servicio_dias_especiales
  FOR DELETE
  USING (can_edit_asignaciones_servicio(congregacion_id));