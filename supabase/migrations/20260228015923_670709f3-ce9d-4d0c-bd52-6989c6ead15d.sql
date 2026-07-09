
-- RPC pública para obtener manzanas trabajadas del ciclo activo de un territorio
CREATE OR REPLACE FUNCTION public.get_manzanas_trabajadas_ciclo_activo(_territorio_id uuid)
RETURNS TABLE(manzana_id uuid, letra text, fecha_trabajada date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    mt.manzana_id,
    mz.letra,
    mt.fecha_trabajada
  FROM manzanas_trabajadas mt
  JOIN manzanas_territorio mz ON mz.id = mt.manzana_id
  JOIN ciclos_territorio ct ON ct.id = mt.ciclo_id
  WHERE ct.territorio_id = _territorio_id
    AND ct.completado = false
  ORDER BY mz.letra;
$$;
