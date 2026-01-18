-- Función para verificar si existe una congregación con un nombre dado (accesible públicamente)
CREATE OR REPLACE FUNCTION public.check_congregation_name_exists(_nombre text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.congregaciones 
    WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(_nombre))
      AND activo = true
  )
$$;