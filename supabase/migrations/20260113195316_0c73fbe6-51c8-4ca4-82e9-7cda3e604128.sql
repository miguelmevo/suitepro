-- Permitir lectura pública de territorios activos
CREATE POLICY "Lectura pública de territorios" 
ON public.territorios 
FOR SELECT 
USING (activo = true);

-- Permitir lectura pública de manzanas de territorio
CREATE POLICY "Lectura pública de manzanas_territorio" 
ON public.manzanas_territorio 
FOR SELECT 
USING (activo = true);

-- Permitir lectura pública de direcciones bloqueadas activas
CREATE POLICY "Lectura pública de direcciones_bloqueadas" 
ON public.direcciones_bloqueadas 
FOR SELECT 
USING (activo = true);