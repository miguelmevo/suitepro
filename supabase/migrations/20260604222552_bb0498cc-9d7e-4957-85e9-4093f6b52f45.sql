
-- Fase 2: RPCs públicas para Vida y Ministerio + Reunión Pública

CREATE OR REPLACE FUNCTION public.get_vym_publico_completo(
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
      SELECT jsonb_agg(to_jsonb(pvm.*))
      FROM programa_vida_ministerio pvm
      WHERE pvm.congregacion_id = _congregacion_id
        AND pvm.activo = true
        AND pvm.fecha_semana >= _desde
        AND pvm.fecha_semana <= _hasta
    ), '[]'::jsonb),
    'participantes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido))
      FROM participantes p
      WHERE p.congregacion_id = _congregacion_id AND p.activo = true
    ), '[]'::jsonb)
  )
  INTO result;
  RETURN result;
END;
$$;

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
    ), '[]'::jsonb)
  )
  INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vym_publico_completo(uuid, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reunion_publica_publico_completo(uuid, date, date) TO anon, authenticated;
