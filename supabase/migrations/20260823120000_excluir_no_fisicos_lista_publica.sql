-- Los territorios marcados como "no físicos" (sin manzanas) ya no deben
-- aparecer en la lista general de territorios (donde el publicador elige
-- cuál abrir) — dejan de ser seleccionables ahí, igual que si no
-- existieran para efectos de predicación puerta a puerta.
CREATE OR REPLACE FUNCTION public.get_territorios_publicos(_congregacion_id uuid)
RETURNS TABLE(id uuid, numero text, nombre text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT t.id, t.numero, t.nombre
  FROM public.territorios t
  WHERE t.congregacion_id = _congregacion_id
    AND t.activo = true
    AND t.tiene_manzanas = true
  ORDER BY
    -- ordenar numéricamente cuando sea posible
    NULLIF(regexp_replace(t.numero, '\D', '', 'g'), '')::int NULLS LAST,
    t.numero ASC;
$function$;
