
CREATE OR REPLACE FUNCTION public.get_asignaciones_servicio_publico_completo(
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
  _result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.congregaciones WHERE id = _congregacion_id AND activo = true) THEN
    RETURN jsonb_build_object('error', 'congregation_not_found');
  END IF;

  SELECT jsonb_build_object(
    'asignaciones', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'fecha', a.fecha,
          'dia_reunion', a.dia_reunion,
          'tipo_asignacion', a.tipo_asignacion,
          'participante_id', a.participante_id,
          'grupo_predicacion_id', a.grupo_predicacion_id,
          'notas', a.notas,
          'activo', a.activo
        ) ORDER BY a.fecha
      )
      FROM public.programa_asignaciones_servicio a
      WHERE a.congregacion_id = _congregacion_id
        AND a.activo = true
        AND a.fecha >= _desde
        AND a.fecha <= _hasta
    ), '[]'::jsonb),

    'participantes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido))
      FROM public.participantes p
      WHERE p.congregacion_id = _congregacion_id AND p.activo = true
    ), '[]'::jsonb),

    'grupos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'numero', g.numero,
          'activo', g.activo,
          'superintendente', (
            SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido)
            FROM public.participantes p
            WHERE p.congregacion_id = _congregacion_id
              AND p.activo = true
              AND p.es_publicador_inactivo = false
              AND p.grupo_predicacion_id = g.id
              AND p.responsabilidad_adicional = 'superintendente_grupo'
            LIMIT 1
          ),
          'auxiliar', (
            SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido)
            FROM public.participantes p
            WHERE p.congregacion_id = _congregacion_id
              AND p.activo = true
              AND p.es_publicador_inactivo = false
              AND p.grupo_predicacion_id = g.id
              AND p.responsabilidad_adicional = 'auxiliar_grupo'
            LIMIT 1
          )
        ) ORDER BY g.numero
      )
      FROM public.grupos_predicacion g
      WHERE g.congregacion_id = _congregacion_id AND g.activo = true
    ), '[]'::jsonb),

    'configuracion', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('clave', cs.clave, 'valor', cs.valor)
      )
      FROM public.configuracion_sistema cs
      WHERE cs.congregacion_id = _congregacion_id
        AND cs.programa_tipo = 'asignaciones'
        AND cs.clave IN ('nota_asignaciones', 'aseo_areas', 'aseo_grupos_por_reunion')
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_asignaciones_servicio_publico_completo(uuid, date, date) TO anon, authenticated;
