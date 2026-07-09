
CREATE OR REPLACE FUNCTION public.get_territorios_publicos(_congregacion_id uuid)
RETURNS TABLE(id uuid, numero text, nombre text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.numero, t.nombre
  FROM public.territorios t
  WHERE t.congregacion_id = _congregacion_id
    AND t.activo = true
  ORDER BY
    -- ordenar numéricamente cuando sea posible
    NULLIF(regexp_replace(t.numero, '\D', '', 'g'), '')::int NULLS LAST,
    t.numero ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_territorios_publicos(uuid) TO anon, authenticated;
