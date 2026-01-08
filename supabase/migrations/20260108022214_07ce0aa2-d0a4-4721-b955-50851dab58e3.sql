
-- Actualizar la función para que elimine profiles y user_roles de usuarios huérfanos
CREATE OR REPLACE FUNCTION public.delete_congregation_cascade(_congregacion_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  orphan_user_ids uuid[];
BEGIN
  -- Verificar que el usuario tiene permiso para eliminar esta congregación
  IF NOT is_congregation_admin(_congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Identificar usuarios que SOLO pertenecen a esta congregación (quedarán huérfanos)
  SELECT ARRAY_AGG(uc.user_id) INTO orphan_user_ids
  FROM usuarios_congregacion uc
  WHERE uc.congregacion_id = _congregacion_id
    AND uc.activo = true
    AND NOT EXISTS (
      SELECT 1 FROM usuarios_congregacion uc2
      WHERE uc2.user_id = uc.user_id
        AND uc2.congregacion_id != _congregacion_id
        AND uc2.activo = true
    );

  -- Eliminar datos de la congregación en orden para respetar FK
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

  -- Eliminar usuarios huérfanos (profiles y roles)
  IF orphan_user_ids IS NOT NULL AND array_length(orphan_user_ids, 1) > 0 THEN
    DELETE FROM user_roles WHERE user_id = ANY(orphan_user_ids);
    DELETE FROM profiles WHERE id = ANY(orphan_user_ids);
  END IF;
END;
$function$;
