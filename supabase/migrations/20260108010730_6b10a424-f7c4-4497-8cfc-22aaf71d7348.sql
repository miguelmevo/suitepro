-- Función para eliminar congregación y todos sus datos relacionados
CREATE OR REPLACE FUNCTION public.delete_congregation_cascade(_congregacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar que el usuario tiene permiso para eliminar esta congregación
  IF NOT is_congregation_admin(_congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Eliminar en orden para respetar FK
  DELETE FROM configuracion_sistema WHERE congregacion_id = _congregacion_id;
  DELETE FROM disponibilidad_capitanes WHERE congregacion_id = _congregacion_id;
  DELETE FROM asignaciones_capitan_fijas WHERE congregacion_id = _congregacion_id;
  DELETE FROM miembros_grupo WHERE congregacion_id = _congregacion_id;
  DELETE FROM grupos_servicio WHERE congregacion_id = _congregacion_id;
  DELETE FROM programa_predicacion WHERE congregacion_id = _congregacion_id;
  DELETE FROM programas_publicados WHERE congregacion_id = _congregacion_id;
  DELETE FROM mensajes_adicionales WHERE congregacion_id = _congregacion_id;
  DELETE FROM dias_especiales WHERE congregacion_id = _congregacion_id;
  DELETE FROM puntos_encuentro WHERE congregacion_id = _congregacion_id;
  DELETE FROM horarios_salida WHERE congregacion_id = _congregacion_id;
  DELETE FROM manzanas_territorio WHERE congregacion_id = _congregacion_id;
  DELETE FROM territorios WHERE congregacion_id = _congregacion_id;
  DELETE FROM participantes WHERE congregacion_id = _congregacion_id;
  DELETE FROM grupos_predicacion WHERE congregacion_id = _congregacion_id;
  DELETE FROM usuarios_congregacion WHERE congregacion_id = _congregacion_id;
  DELETE FROM congregaciones WHERE id = _congregacion_id;
END;
$$;