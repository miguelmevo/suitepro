-- Drop the existing unique index that doesn't consider congregacion_id
DROP INDEX IF EXISTS territorios_numero_activo_key;

-- Create new unique index that considers congregacion_id
-- This allows the same territorio number in different congregations
CREATE UNIQUE INDEX territorios_numero_congregacion_activo_key 
ON public.territorios (numero, congregacion_id) 
WHERE (activo = true);