-- Crear tabla mensajes_adicionales para franjas informativas en el programa
CREATE TABLE public.mensajes_adicionales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  mensaje TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1e3a5f',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.mensajes_adicionales ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios autenticados pueden ver mensajes_adicionales"
  ON public.mensajes_adicionales
  FOR SELECT
  USING (true);

CREATE POLICY "Admin y Editor pueden crear mensajes_adicionales"
  ON public.mensajes_adicionales
  FOR INSERT
  WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar mensajes_adicionales"
  ON public.mensajes_adicionales
  FOR UPDATE
  USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar mensajes_adicionales"
  ON public.mensajes_adicionales
  FOR DELETE
  USING (is_admin_or_editor(auth.uid()));