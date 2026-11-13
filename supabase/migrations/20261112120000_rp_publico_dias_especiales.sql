-- Vista pública de Reunión Pública: incluir también los días especiales de
-- la semana (hasta 2 motivos por fecha) para mostrarlos en la tarjeta de Inicio
-- aunque no haya programa ese día. Cambio aditivo: solo agrega la clave
-- 'dias_especiales' al resultado.
CREATE OR REPLACE FUNCTION public.get_reunion_publica_publico_completo(
  _congregacion_id uuid,
  _desde date,
  _hasta date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'programa', COALESCE((
      SELECT jsonb_agg(to_jsonb(prp.*))
      FROM programa_reunion_publica prp
      WHERE prp.congregacion_id = _congregacion_id
        AND prp.activo = true
        AND prp.fecha >= _desde
        AND prp.fecha <= _hasta
    ), '[]'::jsonb),
    'participantes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido))
      FROM participantes p
      WHERE p.congregacion_id = _congregacion_id AND p.activo = true
    ), '[]'::jsonb),
    'dias_especiales', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('fecha', d.fecha, 'slot', d.slot, 'mensaje', d.mensaje, 'color', d.color) ORDER BY d.fecha, d.slot)
      FROM reunion_publica_dias_especiales d
      WHERE d.congregacion_id = _congregacion_id
        AND d.fecha >= _desde
        AND d.fecha <= _hasta
    ), '[]'::jsonb)
  )
  INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reunion_publica_publico_completo(uuid, date, date) TO anon, authenticated;
