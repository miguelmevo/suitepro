
-- 1) Migrar filas existentes de 'configuracion_ajustes' a los 6 nuevos sub-modulos
INSERT INTO public.permisos_usuario_congregacion
  (user_id, congregacion_id, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar)
SELECT user_id, congregacion_id, m.nuevo, puede_ver, puede_crear, puede_editar, puede_eliminar
FROM public.permisos_usuario_congregacion p
CROSS JOIN (VALUES
  ('ajustes_general'),
  ('ajustes_asignaciones'),
  ('ajustes_vida_ministerio'),
  ('ajustes_reunion_publica'),
  ('ajustes_predicacion'),
  ('ajustes_carritos')
) AS m(nuevo)
WHERE p.modulo = 'configuracion_ajustes'
ON CONFLICT DO NOTHING;

DELETE FROM public.permisos_usuario_congregacion WHERE modulo = 'configuracion_ajustes';

-- 2) Actualizar has_permission para reconocer los nuevos modulos en el fallback legacy
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _congregacion_id uuid, _modulo text, _accion text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _granular_exists boolean;
  _granular_allows boolean;
  _user_rol app_role;
BEGIN
  IF _user_id IS NULL OR _congregacion_id IS NULL OR _modulo IS NULL OR _accion IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_super_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT
    true,
    CASE _accion
      WHEN 'ver' THEN puede_ver
      WHEN 'crear' THEN puede_crear
      WHEN 'editar' THEN puede_editar
      WHEN 'eliminar' THEN puede_eliminar
      ELSE false
    END
  INTO _granular_exists, _granular_allows
  FROM public.permisos_usuario_congregacion
  WHERE user_id = _user_id
    AND congregacion_id = _congregacion_id
    AND modulo = _modulo
  LIMIT 1;

  IF _granular_exists THEN
    RETURN COALESCE(_granular_allows, false);
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

  -- admin: todo
  IF _user_rol = 'admin'::app_role THEN
    RETURN true;
  END IF;

  -- editor: todo excepto cierre_* (solo admin/super_admin pueden cerrar/reabrir)
  IF _user_rol = 'editor'::app_role THEN
    IF _modulo IN ('cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio') THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  -- viewer: solo lectura en casi todo
  IF _user_rol = 'viewer'::app_role AND _accion = 'ver' THEN
    RETURN _modulo NOT IN (
      'configuracion_usuarios',
      'cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio'
    );
  END IF;

  -- sservicio: lectura predicacion
  IF _user_rol = 'sservicio'::app_role AND _accion = 'ver' THEN
    RETURN _modulo IN (
      'inicio','programas_del_mes',
      'predicacion_programa','predicacion_capitanes','predicacion_puntos',
      'predicacion_carritos','predicacion_territorios',
      'predicacion_territorios_historial','predicacion_historial'
    );
  END IF;

  -- srpublica: lectura + escritura reunion publica
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

  -- svministerio: lectura + escritura vida y ministerio
  IF _user_rol = 'svministerio'::app_role THEN
    IF _accion = 'ver' THEN
      RETURN _modulo IN (
        'inicio','programas_del_mes',
        'vym_programa','vym_lectores_ebc','vym_historial'
      );
    ELSE
      RETURN _modulo IN ('vym_programa','vym_lectores_ebc','vym_historial');
    END IF;
  END IF;

  -- saservicio: lectura + escritura asignaciones servicio
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

-- 3) Actualizar get_my_permissions con la nueva lista de modulos
CREATE OR REPLACE FUNCTION public.get_my_permissions(_congregacion_id uuid)
RETURNS TABLE(modulo text, puede_ver boolean, puede_crear boolean, puede_editar boolean, puede_eliminar boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _modulos text[] := ARRAY[
    'inicio','programas_del_mes',
    'predicacion_programa','predicacion_capitanes','predicacion_puntos',
    'predicacion_carritos','predicacion_territorios',
    'predicacion_territorios_historial','predicacion_historial',
    'reunion_publica_programa','reunion_publica_lectores',
    'vym_programa','vym_lectores_ebc','vym_historial',
    'asignaciones_servicio',
    'configuracion_participantes','configuracion_grupos',
    'configuracion_dias_especiales',
    'ajustes_general','ajustes_asignaciones','ajustes_vida_ministerio',
    'ajustes_reunion_publica','ajustes_predicacion','ajustes_carritos',
    'configuracion_usuarios',
    'cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio'
  ];
  _m text;
BEGIN
  IF _uid IS NULL OR _congregacion_id IS NULL THEN
    RETURN;
  END IF;

  FOREACH _m IN ARRAY _modulos LOOP
    modulo := _m;
    puede_ver := public.has_permission(_uid, _congregacion_id, _m, 'ver');
    puede_crear := public.has_permission(_uid, _congregacion_id, _m, 'crear');
    puede_editar := public.has_permission(_uid, _congregacion_id, _m, 'editar');
    puede_eliminar := public.has_permission(_uid, _congregacion_id, _m, 'eliminar');
    RETURN NEXT;
  END LOOP;
END;
$function$;
