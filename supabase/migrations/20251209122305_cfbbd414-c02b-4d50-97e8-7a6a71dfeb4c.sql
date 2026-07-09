-- Tabla para tipos de programa (predicación, limpieza, etc.)
CREATE TABLE public.tipos_programa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  icono TEXT DEFAULT 'calendar',
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tipos_programa ENABLE ROW LEVEL SECURITY;

-- Políticas públicas
CREATE POLICY "Cualquiera puede ver tipos_programa" 
ON public.tipos_programa FOR SELECT USING (true);

CREATE POLICY "Cualquiera puede crear tipos_programa" 
ON public.tipos_programa FOR INSERT WITH CHECK (true);

CREATE POLICY "Cualquiera puede actualizar tipos_programa" 
ON public.tipos_programa FOR UPDATE USING (true);

CREATE POLICY "Cualquiera puede eliminar tipos_programa" 
ON public.tipos_programa FOR DELETE USING (true);

-- Insertar tipo inicial: Predicación
INSERT INTO public.tipos_programa (nombre, descripcion, icono, orden) 
VALUES ('Predicación', 'Programa de predicación de la congregación', 'megaphone', 0);