
-- 1) has_permission: viewer role should NOT have access to participant data (includes phone numbers)
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
    IF _modulo IN ('cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio','cierre_predicacion') THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF _user_rol = 'viewer'::app_role AND _accion = 'ver' THEN
    RETURN _modulo NOT IN (
      'configuracion_usuarios',
      'configuracion_participantes',
      'cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio','cierre_predicacion'
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

-- 2) Auto-registro: bloquear si el usuario ya tiene una membresía activa en esa congregación
DROP POLICY IF EXISTS "Usuario puede auto-registrarse en congregación" ON public.usuarios_congregacion;
CREATE POLICY "Usuario puede auto-registrarse en congregación"
ON public.usuarios_congregacion
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND rol = 'user'
  AND activo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.usuarios_congregacion existing
    WHERE existing.user_id = auth.uid()
      AND existing.congregacion_id = usuarios_congregacion.congregacion_id
      AND existing.activo = true
  )
);

-- 3) Hardening storage policies: bloquear explícitamente nombres de archivo que no resuelven a un territorio real
DROP POLICY IF EXISTS "Territorios: subir solo en la propia congregación" ON storage.objects;
CREATE POLICY "Territorios: subir solo en la propia congregación"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'territorios'
  AND public.storage_territorio_congregacion_id(name) IS NOT NULL
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
);

DROP POLICY IF EXISTS "Territorios: actualizar solo en la propia congregación" ON storage.objects;
CREATE POLICY "Territorios: actualizar solo en la propia congregación"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'territorios'
  AND public.storage_territorio_congregacion_id(name) IS NOT NULL
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
)
WITH CHECK (
  bucket_id = 'territorios'
  AND public.storage_territorio_congregacion_id(name) IS NOT NULL
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
);

DROP POLICY IF EXISTS "Territorios: eliminar solo en la propia congregación" ON storage.objects;
CREATE POLICY "Territorios: eliminar solo en la propia congregación"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'territorios'
  AND public.storage_territorio_congregacion_id(name) IS NOT NULL
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
);
