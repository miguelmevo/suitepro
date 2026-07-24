-- Tabla de "días especiales asignados" para Reunión Pública, análoga a
-- asignaciones_servicio_dias_especiales: registra qué evento del catálogo general
-- (dias_especiales) se marcó en una fecha puntual de ESTE programa en particular,
-- con su propio color de PDF opcional (independiente de otros programas).
CREATE TABLE public.reunion_publica_dias_especiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregacion_id uuid NOT NULL,
  fecha date NOT NULL,
  mensaje text NOT NULL,
  color text NOT NULL DEFAULT '#1e3a5f',
  color_pdf text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rp_dias_esp_unique UNIQUE (congregacion_id, fecha)
);

ALTER TABLE public.reunion_publica_dias_especiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven dias esp RP de su congregacion"
  ON public.reunion_publica_dias_especiales
  FOR SELECT
  USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor insertan dias esp RP"
  ON public.reunion_publica_dias_especiales
  FOR INSERT
  WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor actualizan dias esp RP"
  ON public.reunion_publica_dias_especiales
  FOR UPDATE
  USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor eliminan dias esp RP"
  ON public.reunion_publica_dias_especiales
  FOR DELETE
  USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- Permitir "reunion_publica" como módulo válido para mensajes adicionales
-- (hoy solo admitía predicacion / asignaciones_servicio / ambos).
ALTER TABLE public.mensajes_adicionales
  DROP CONSTRAINT IF EXISTS mensajes_adicionales_modulo_check;
ALTER TABLE public.mensajes_adicionales
  ADD CONSTRAINT mensajes_adicionales_modulo_check
  CHECK (modulo IN ('predicacion', 'asignaciones_servicio', 'reunion_publica', 'ambos'));
