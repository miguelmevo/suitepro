-- Crear tabla para grupos de predicación con sus líderes
CREATE TABLE public.grupos_predicacion (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero integer NOT NULL UNIQUE,
  superintendente_id uuid REFERENCES public.participantes(id) ON DELETE SET NULL,
  auxiliar_id uuid REFERENCES public.participantes(id) ON DELETE SET NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.grupos_predicacion ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Cualquiera puede ver grupos_predicacion" 
ON public.grupos_predicacion 
FOR SELECT 
USING (true);

CREATE POLICY "Admin y Editor pueden modificar grupos_predicacion" 
ON public.grupos_predicacion 
FOR ALL 
USING (is_admin_or_editor(auth.uid()))
WITH CHECK (is_admin_or_editor(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_grupos_predicacion_updated_at
BEFORE UPDATE ON public.grupos_predicacion
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();