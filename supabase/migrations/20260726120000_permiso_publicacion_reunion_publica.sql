-- Nuevo módulo de permiso granular "publicacion_reunion_publica" (Publicar/
-- despublicar el programa de Reunión Pública), independiente de "crear" en
-- reunion_publica_programa y de "cierre_reunion_publica". La columna
-- "modulo" es texto libre, así que no requiere cambios de esquema — solo
-- actualizar el fallback de roles legacy en has_permission para que, igual
-- que los módulos de cierre, no se otorgue implícitamente a editor/viewer.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _congregacion_id uuid, _modulo text, _accion text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _has_explicit boolean;
  _row record;
  _user_rol public.app_role;
BEGIN
  IF _user_id IS NULL OR _congregacion_id IS NULL OR _modulo IS NULL OR _accion IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(_user_id, 'super_admin'::app_role) THEN
    RETURN true;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.permisos_usuario_congregacion
    WHERE user_id = _user_id AND congregacion_id = _congregacion_id
  ) INTO _has_explicit;

  IF _has_explicit THEN
    SELECT * INTO _row
    FROM public.permisos_usuario_congregacion
    WHERE user_id = _user_id
      AND congregacion_id = _congregacion_id
      AND modulo = _modulo
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    RETURN CASE _accion
      WHEN 'ver' THEN _row.puede_ver
      WHEN 'crear' THEN _row.puede_crear
      WHEN 'editar' THEN _row.puede_editar
      WHEN 'eliminar' THEN _row.puede_eliminar
      ELSE false
    END;
  END IF;

  SELECT rol INTO _user_rol
  FROM public.usuarios_congregacion
  WHERE user_id = _user_id
    AND congregacion_id = _congregacion_id
    AND activo = true
  LIMIT 1;

  IF _user_rol IS NULL THEN
    RETURN false;
  END IF;

  IF _user_rol = 'admin'::app_role THEN
    RETURN true;
  END IF;

  IF _user_rol = 'editor'::app_role THEN
    IF _modulo IN ('cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio','cierre_predicacion','publicacion_reunion_publica') THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF _user_rol = 'viewer'::app_role AND _accion = 'ver' THEN
    RETURN _modulo NOT IN (
      'configuracion_usuarios',
      'configuracion_participantes',
      'cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio','cierre_predicacion','publicacion_reunion_publica'
    );
  END IF;

  IF _user_rol = 'sservicio'::app_role AND _accion = 'ver' THEN
    RETURN _modulo IN (
      'inicio','programas_del_mes',
      'predicacion_programa','predicacion_capitanes','predicacion_puntos',
      'predicacion_carritos','predicacion_territorios',
      'predicacion_territorios_historial','predicacion_historial'
    );
  END IF;

  IF _user_rol = 'srpublica'::app_role THEN
    IF _accion = 'ver' THEN
      RETURN _modulo IN (
        'inicio','programas_del_mes',
        'reunion_publica_programa','reunion_publica_lectores'
      );
    ELSE
      RETURN _modulo IN ('reunion_publica_programa','reunion_publica_lectores');
    END IF;
  END IF;

  IF _user_rol = 'svministerio'::app_role THEN
    IF _modulo = 'configuracion_participantes' THEN
      RETURN _accion IN ('ver','editar');
    END IF;
    IF _accion = 'ver' THEN
      RETURN _modulo IN (
        'inicio','programas_del_mes',
        'vym_programa','vym_lectores_ebc','vym_historial'
      );
    ELSE
      RETURN _modulo IN ('vym_programa','vym_lectores_ebc','vym_historial');
    END IF;
  END IF;

  IF _user_rol = 'saservicio'::app_role THEN
    IF _accion = 'ver' THEN
      RETURN _modulo IN ('inicio','programas_del_mes','asignaciones_servicio');
    ELSE
      RETURN _modulo IN ('asignaciones_servicio');
    END IF;
  END IF;

  RETURN false;
END;
$function$;
