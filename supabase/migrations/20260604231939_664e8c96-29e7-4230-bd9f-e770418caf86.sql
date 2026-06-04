CREATE OR REPLACE FUNCTION public.get_liderazgo_grupos(_congregacion_id uuid)
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  grupo_predicacion_id uuid,
  responsabilidad_adicional text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nombre, p.apellido, p.grupo_predicacion_id, p.responsabilidad_adicional
  FROM public.participantes p
  WHERE p.congregacion_id = _congregacion_id
    AND p.activo = true
    AND p.es_publicador_inactivo = false
    AND p.responsabilidad_adicional IN ('superintendente_grupo','auxiliar_grupo')
    AND public.user_has_access_to_congregacion(_congregacion_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_liderazgo_grupos(uuid) TO authenticated;