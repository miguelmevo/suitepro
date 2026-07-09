
-- Create carritos table
CREATE TABLE public.carritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL,
  ubicacion text NOT NULL,
  direccion text,
  url_maps text,
  activo boolean NOT NULL DEFAULT true,
  congregacion_id uuid NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint per congregation
ALTER TABLE public.carritos ADD CONSTRAINT carritos_numero_congregacion_unique UNIQUE (numero, congregacion_id);

-- Enable RLS
ALTER TABLE public.carritos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuarios pueden ver carritos de su congregación"
  ON public.carritos FOR SELECT
  USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear carritos en su congregación"
  ON public.carritos FOR INSERT
  WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar carritos de su congregación"
  ON public.carritos FOR UPDATE
  USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar carritos de su congregación"
  ON public.carritos FOR DELETE
  USING (is_admin_or_editor_in_congregacion(congregacion_id));
