-- La página de registro (sin sesión) necesita saber si la congregación exige el consentimiento,
-- pero la tabla de configuración solo la leen los miembros. Esta función expone ÚNICAMENTE ese dato.
CREATE OR REPLACE FUNCTION public.get_consentimiento_obligatorio_publico(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (valor->>'obligatorio')::boolean
       FROM public.configuracion_sistema
      WHERE congregacion_id = _congregacion_id
        AND programa_tipo = 'general'
        AND clave = 'consentimiento'
      LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_consentimiento_obligatorio_publico(uuid) TO anon, authenticated;
