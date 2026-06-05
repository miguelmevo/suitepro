
-- =============================================
-- Tabla de permisos granulares por usuario
-- =============================================
CREATE TABLE public.permisos_usuario_congregacion (
  user_id uuid NOT NULL,
  congregacion_id uuid NOT NULL,
  modulo text NOT NULL,
  puede_ver boolean NOT NULL DEFAULT false,
  puede_crear boolean NOT NULL DEFAULT false,
  puede_editar boolean NOT NULL DEFAULT false,
  puede_eliminar boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, congregacion_id, modulo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permisos_usuario_congregacion TO authenticated;
GRANT ALL ON public.permisos_usuario_congregacion TO service_role;

ALTER TABLE public.permisos_usuario_congregacion ENABLE ROW LEVEL SECURITY;

-- El usuario ve sus propios permisos
CREATE POLICY "Usuario ve sus propios permisos"
ON public.permisos_usuario_congregacion
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins de la congregación ven todos los permisos de sus miembros
CREATE POLICY "Admins ven permisos de su congregación"
ON public.permisos_usuario_congregacion
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = permisos_usuario_congregacion.congregacion_id
      AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
      AND uc.activo = true
  )
);

-- Admins gestionan permisos
CREATE POLICY "Admins crean permisos en su congregación"
ON public.permisos_usuario_congregacion
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = permisos_usuario_congregacion.congregacion_id
      AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
      AND uc.activo = true
  )
);

CREATE POLICY "Admins actualizan permisos en su congregación"
ON public.permisos_usuario_congregacion
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = permisos_usuario_congregacion.congregacion_id
      AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
      AND uc.activo = true
  )
);

CREATE POLICY "Admins eliminan permisos en su congregación"
ON public.permisos_usuario_congregacion
FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = permisos_usuario_congregacion.congregacion_id
      AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
      AND uc.activo = true
  )
);

-- Trigger updated_at
CREATE TRIGGER update_permisos_usuario_congregacion_updated_at
BEFORE UPDATE ON public.permisos_usuario_congregacion
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================
-- Función has_permission: granular + fallback legacy
-- =============================================
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _congregacion_id uuid,
  _modulo text,
  _accion text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _granular_exists boolean;
  _granular_allows boolean;
  _user_rol app_role;
BEGIN
  IF _user_id IS NULL OR _congregacion_id IS NULL OR _modulo IS NULL OR _accion IS NULL THEN
    RETURN false;
  END IF;

  -- Super admin: acceso total
  IF public.is_super_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- ¿Existe fila granular para este módulo?
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
    -- Si hay fila granular, ella manda (no se aplica fallback)
    RETURN COALESCE(_granular_allows, false);
  END IF;

  -- Fallback legacy: deducir del rol del usuario en la congregación
  SELECT rol INTO _user_rol
  FROM public.usuarios_congregacion
  WHERE user_id = _user_id
    AND congregacion_id = _congregacion_id
    AND activo = true
  LIMIT 1;

  IF _user_rol IS NULL THEN
    RETURN false;
  END IF;

  -- admin / editor: todo
  IF _user_rol IN ('admin'::app_role, 'editor'::app_role) THEN
    RETURN true;
  END IF;

  -- Mapa legacy por (rol, módulo, acción)
  -- viewer: solo lectura en casi todo (excepto usuarios)
  IF _user_rol = 'viewer'::app_role AND _accion = 'ver' THEN
    RETURN _modulo NOT IN ('configuracion_usuarios');
  END IF;

  -- sservicio: lectura predicación
  IF _user_rol = 'sservicio'::app_role AND _accion = 'ver' THEN
    RETURN _modulo IN (
      'inicio','programas_del_mes',
      'predicacion_programa','predicacion_capitanes','predicacion_puntos',
      'predicacion_carritos','predicacion_territorios',
      'predicacion_territorios_historial','predicacion_historial'
    );
  END IF;

  -- srpublica: lectura + escritura reunión pública
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

  -- svministerio: lectura + escritura VyM
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

  -- saservicio: lectura amplia + escritura en asignaciones de servicio
  IF _user_rol = 'saservicio'::app_role THEN
    IF _accion = 'ver' THEN
      RETURN _modulo IN (
        'inicio','programas_del_mes',
        'predicacion_programa','predicacion_capitanes','predicacion_puntos',
        'predicacion_carritos','predicacion_territorios',
        'predicacion_territorios_historial','predicacion_historial',
        'reunion_publica_programa','reunion_publica_lectores',
        'vym_programa','vym_lectores_ebc','vym_historial',
        'asignaciones_servicio'
      );
    ELSE
      RETURN _modulo = 'asignaciones_servicio';
    END IF;
  END IF;

  RETURN false;
END;
$$;


-- =============================================
-- RPC: devolver todos los permisos efectivos del usuario actual
-- =============================================
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
    'inicio','programas_del_mes',
    'predicacion_programa','predicacion_capitanes','predicacion_puntos',
    'predicacion_carritos','predicacion_territorios',
    'predicacion_territorios_historial','predicacion_historial',
    'reunion_publica_programa','reunion_publica_lectores',
    'vym_programa','vym_lectores_ebc','vym_historial',
    'asignaciones_servicio',
    'configuracion_participantes','configuracion_grupos',
    'configuracion_dias_especiales','configuracion_ajustes',
    'configuracion_usuarios'
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

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_permissions(uuid) TO authenticated, service_role;
