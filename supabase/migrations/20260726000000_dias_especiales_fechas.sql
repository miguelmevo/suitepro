-- Permite asignar una fecha concreta a un día especial UNA sola vez, desde
-- Configuración → Ajustes del Sistema → Días Especiales, indicando a qué
-- programas aplica (Reunión Pública y/o Asignaciones de Servicio). Al abrir
-- el programa de un mes que contiene esa fecha, se aplica automáticamente
-- (bloqueo con el motivo) sin tener que marcarlo a mano en cada programa.
CREATE TABLE public.dias_especiales_fechas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregacion_id uuid NOT NULL,
  fecha date NOT NULL,
  motivo text NOT NULL,
  color text NOT NULL DEFAULT '#1e3a5f',
  bloqueo_tipo text NOT NULL DEFAULT 'completo' CHECK (bloqueo_tipo IN ('completo', 'manana', 'tarde')),
  programas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dias_esp_fechas_unique UNIQUE (congregacion_id, fecha)
);

ALTER TABLE public.dias_especiales_fechas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven fechas de dias especiales de su congregacion"
  ON public.dias_especiales_fechas
  FOR SELECT
  USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor insertan fechas de dias especiales"
  ON public.dias_especiales_fechas
  FOR INSERT
  WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor actualizan fechas de dias especiales"
  ON public.dias_especiales_fechas
  FOR UPDATE
  USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor eliminan fechas de dias especiales"
  ON public.dias_especiales_fechas
  FOR DELETE
  USING (is_admin_or_editor_in_congregacion(congregacion_id));
