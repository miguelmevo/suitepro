-- Add unique constraint on numero column for active territories
CREATE UNIQUE INDEX territorios_numero_activo_key 
ON public.territorios (numero) 
WHERE activo = true;