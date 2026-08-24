-- Territorios que no son físicos (ej. de negocios, teléfono, sin manzanas
-- reales) no deben pedir manzanas ni aparecer en el historial de manzanas
-- trabajadas. Default true: no cambia el comportamiento de los territorios
-- ya existentes.
ALTER TABLE public.territorios
  ADD COLUMN IF NOT EXISTS tiene_manzanas boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_territorio_publico(uuid);

CREATE OR REPLACE FUNCTION public.get_territorio_publico(_territorio_id uuid)
RETURNS TABLE(id uuid, numero text, nombre text, imagen_url text, url_maps text, congregacion_id uuid, tiene_manzanas boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    t.id,
    t.numero,
    t.nombre,
    t.imagen_url,
    t.url_maps,
    t.congregacion_id,
    t.tiene_manzanas
  FROM public.territorios t
  WHERE t.id = _territorio_id
    AND t.activo = true;
$function$;
