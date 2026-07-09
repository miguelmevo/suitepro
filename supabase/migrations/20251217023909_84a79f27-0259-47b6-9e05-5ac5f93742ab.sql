-- Tabla para días especiales (bloquean predicación)
CREATE TABLE public.dias_especiales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  bloqueo_tipo TEXT NOT NULL CHECK (bloqueo_tipo IN ('completo', 'manana', 'tarde')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.dias_especiales ENABLE ROW LEVEL SECURITY;

-- Política de acceso público
CREATE POLICY "Acceso público dias_especiales" 
ON public.dias_especiales 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Índice para búsqueda por fecha
CREATE INDEX idx_dias_especiales_fecha ON public.dias_especiales(fecha);