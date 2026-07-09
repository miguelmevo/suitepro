
CREATE OR REPLACE FUNCTION public.get_historial_manzanas_territorio_publico(_territorio_id uuid)
RETURNS TABLE (
  id uuid,
  letra text,
  fecha_trabajada date,
  marcado_por uuid,
  responsable_nombre text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mt.id,
    mz.letra,
    mt.fecha_trabajada,
    mt.marcado_por,
    COALESCE(p.nombre || ' ' || p.apellido, pr.nombre || ' ' || pr.apellido, '—') AS responsable_nombre
  FROM public.manzanas_trabajadas mt
  JOIN public.manzanas_territorio mz ON mz.id = mt.manzana_id
  LEFT JOIN public.participantes p ON p.user_id = mt.marcado_por AND p.congregacion_id = mt.congregacion_id
  LEFT JOIN public.profiles pr ON pr.id = mt.marcado_por
  WHERE mt.territorio_id = _territorio_id
  ORDER BY mt.fecha_trabajada DESC, mz.letra ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_historial_manzanas_territorio_publico(uuid) TO anon, authenticated;
