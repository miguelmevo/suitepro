
-- Tabla de lectores elegibles del Estudio Bíblico de la Congregación
CREATE TABLE public.lectores_ebc_elegibles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  congregacion_id uuid NOT NULL,
  participante_id uuid NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (congregacion_id, participante_id)
);

ALTER TABLE public.lectores_ebc_elegibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver lectores EBC de su congregación"
ON public.lectores_ebc_elegibles
FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear lectores EBC en su congregación"
ON public.lectores_ebc_elegibles
FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar lectores EBC de su congregación"
ON public.lectores_ebc_elegibles
FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar lectores EBC de su congregación"
ON public.lectores_ebc_elegibles
FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));
