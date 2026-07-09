
CREATE OR REPLACE FUNCTION public.get_predicacion_publico_completo(
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
  -- Verificar que la congregación existe y está activa
  IF NOT EXISTS (SELECT 1 FROM public.congregaciones WHERE id = _congregacion_id AND activo = true) THEN
    RETURN jsonb_build_object('error', 'congregation_not_found');
  END IF;

  SELECT jsonb_build_object(
    'programa', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'fecha', pp.fecha,
          'horario_id', pp.horario_id,
          'punto_encuentro_id', pp.punto_encuentro_id,
          'territorio_id', pp.territorio_id,
          'territorio_ids', COALESCE(pp.territorio_ids, '{}'::uuid[]),
          'capitan_id', pp.capitan_id,
          'capitan', CASE WHEN cap.id IS NOT NULL THEN
            jsonb_build_object('id', cap.id, 'nombre', cap.nombre, 'apellido', cap.apellido)
            ELSE NULL END,
          'es_mensaje_especial', pp.es_mensaje_especial,
          'mensaje_especial', pp.mensaje_especial,
          'colspan_completo', pp.colspan_completo,
          'es_por_grupos', pp.es_por_grupos,
          'asignaciones_grupos', COALESCE(pp.asignaciones_grupos, '[]'::jsonb),
          'activo', pp.activo,
          'created_at', pp.created_at,
          'updated_at', pp.updated_at
        ) ORDER BY pp.fecha, h.hora NULLS LAST
      )
      FROM public.programa_predicacion pp
      LEFT JOIN public.horarios_salida h ON h.id = pp.horario_id
      LEFT JOIN public.participantes cap ON cap.id = pp.capitan_id
      WHERE pp.congregacion_id = _congregacion_id
        AND pp.activo = true
        AND pp.fecha >= _desde
        AND pp.fecha <= _hasta
    ), '[]'::jsonb),

    'horarios', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id, 'hora', hora, 'nombre', nombre, 'orden', orden,
          'franja', franja, 'activo', activo
        ) ORDER BY orden
      )
      FROM public.horarios_salida
      WHERE congregacion_id = _congregacion_id AND activo = true
    ), '[]'::jsonb),

    'puntos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id, 'nombre', nombre, 'direccion', direccion,
          'url_maps', url_maps, 'numero_salida', numero_salida, 'activo', activo
        ) ORDER BY nombre
      )
      FROM public.puntos_encuentro
      WHERE congregacion_id = _congregacion_id AND activo = true
    ), '[]'::jsonb),

    'territorios', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id, 'numero', t.numero, 'nombre', t.nombre,
          'url_maps', t.url_maps, 'imagen_url', t.imagen_url,
          'grupo_predicacion_id', t.grupo_predicacion_id,
          'grupos_predicacion_ids', COALESCE((
            SELECT array_agg(tg.grupo_predicacion_id)
            FROM public.territorios_grupos_predicacion tg
            WHERE tg.territorio_id = t.id
          ), ARRAY[]::uuid[]),
          'activo', t.activo
        )
      )
      FROM public.territorios t
      WHERE t.congregacion_id = _congregacion_id AND t.activo = true
    ), '[]'::jsonb),

    'grupos_predicacion', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', id, 'numero', numero, 'activo', activo)
        ORDER BY numero
      )
      FROM public.grupos_predicacion
      WHERE congregacion_id = _congregacion_id AND activo = true
    ), '[]'::jsonb),

    'dias_especiales', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id, 'nombre', nombre, 'fecha', fecha, 'color', color,
          'bloquea_reuniones', bloquea_reuniones, 'bloqueo_tipo', bloqueo_tipo,
          'activo', activo
        )
      )
      FROM public.dias_especiales
      WHERE congregacion_id = _congregacion_id AND activo = true
    ), '[]'::jsonb),

    'configuracion_general', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'programa_tipo', programa_tipo, 'clave', clave, 'valor', valor
        )
      )
      FROM public.configuracion_sistema
      WHERE congregacion_id = _congregacion_id
        AND programa_tipo = 'general'
        AND clave IN ('dias_reunion', 'nombre_congregacion')
    ), '[]'::jsonb),

    'mensajes_adicionales', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id, 'fecha', fecha, 'mensaje', mensaje, 'color', color,
          'modulo', modulo
        )
      )
      FROM public.mensajes_adicionales
      WHERE congregacion_id = _congregacion_id
        AND activo = true
        AND fecha >= _desde
        AND fecha <= _hasta
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

-- Permitir invocación pública (anon y authenticated)
GRANT EXECUTE ON FUNCTION public.get_predicacion_publico_completo(uuid, date, date) TO anon, authenticated;
