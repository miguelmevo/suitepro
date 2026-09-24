-- Historial de Reunión Pública con permiso propio ("reunion_publica_historial").
-- Antes compartía el permiso "Programa": quien solo podía ver el programa
-- también veía el historial. Para no quitarle acceso a nadie, quienes ya tenían
-- "Programa" reciben el mismo nivel en el módulo nuevo (y se puede quitar después).

-- 1) has_permission: el rol antiguo "srpublica" incluye el módulo nuevo.
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
    IF _modulo IN (
      'cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio','cierre_predicacion',
      'publicacion_reunion_publica','publicacion_vym','publicacion_asignaciones_servicio','publicacion_predicacion'
    ) THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF _user_rol = 'viewer'::app_role AND _accion = 'ver' THEN
    RETURN _modulo NOT IN (
      'configuracion_usuarios',
      'configuracion_participantes',
      'cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio','cierre_predicacion',
      'publicacion_reunion_publica','publicacion_vym','publicacion_asignaciones_servicio','publicacion_predicacion'
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
        'reunion_publica_programa','reunion_publica_lectores','reunion_publica_historial'
      );
    ELSE
      RETURN _modulo IN ('reunion_publica_programa','reunion_publica_lectores','reunion_publica_historial');
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

-- 2) get_my_permissions expone el módulo nuevo.
CREATE OR REPLACE FUNCTION public.get_my_permissions(_congregacion_id uuid)
RETURNS TABLE (
  modulo text,
  puede_ver boolean,
  puede_crear boolean,
  puede_editar boolean,
  puede_eliminar boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _modulos text[] := ARRAY[
    'inicio','programas_del_mes','ui_forzar_desktop',
    'predicacion_programa','predicacion_capitanes','predicacion_capitanes_lista','predicacion_capitanes_movil','predicacion_puntos',
    'predicacion_carritos','predicacion_territorios',
    'predicacion_territorios_historial','predicacion_historial',
    'reunion_publica_programa','reunion_publica_historial','reunion_publica_lectores',
    'vym_programa','vym_lectores_ebc','vym_historial',
    'asignaciones_servicio',
    'configuracion_participantes','configuracion_grupos',
    'configuracion_dias_especiales',
    'ajustes_general','ajustes_asignaciones','ajustes_vida_ministerio',
    'ajustes_reunion_publica','ajustes_predicacion','ajustes_carritos',
    'configuracion_usuarios',
    'cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio','cierre_predicacion'
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
$$;

-- 3) Perfiles (incluye Administrador): copian el permiso de "Programa".
UPDATE public.perfiles_permisos
SET permisos = permisos || jsonb_build_object('reunion_publica_historial', permisos->'reunion_publica_programa')
WHERE permisos ? 'reunion_publica_programa'
  AND NOT (permisos ? 'reunion_publica_historial');

-- 4) Usuarios con permisos explícitos: copian su fila de "Programa".
INSERT INTO public.permisos_usuario_congregacion
  (user_id, congregacion_id, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar)
SELECT p.user_id, p.congregacion_id, 'reunion_publica_historial',
       p.puede_ver, p.puede_crear, p.puede_editar, p.puede_eliminar
FROM public.permisos_usuario_congregacion p
WHERE p.modulo = 'reunion_publica_programa'
  AND NOT EXISTS (
    SELECT 1 FROM public.permisos_usuario_congregacion x
    WHERE x.user_id = p.user_id AND x.congregacion_id = p.congregacion_id
      AND x.modulo = 'reunion_publica_historial'
  );
