-- Capitanes en el celular: permiso propio "predicacion_capitanes_movil",
-- separado del de escritorio (predicacion_capitanes_lista). Lo reciben los
-- administradores; al resto se lo asigna cada perfil a mano.

-- 1) get_my_permissions expone el módulo nuevo al frontend.
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
    'reunion_publica_programa','reunion_publica_lectores',
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

-- 2) Administrador (perfil de sistema) con acceso completo al módulo nuevo.
UPDATE public.perfiles_permisos
SET permisos = permisos || jsonb_build_object(
  'predicacion_capitanes_movil', '{"ver":true,"crear":true,"editar":true,"eliminar":true}'::jsonb)
WHERE es_sistema = true AND app_role = 'admin';

-- 3) Administradores con permisos explícitos por usuario (sin fila = sin acceso).
INSERT INTO public.permisos_usuario_congregacion
  (user_id, congregacion_id, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar)
SELECT DISTINCT uc.user_id, uc.congregacion_id, 'predicacion_capitanes_movil', true, true, true, true
FROM public.usuarios_congregacion uc
WHERE uc.rol = 'admin' AND uc.activo = true
  AND EXISTS (
    SELECT 1 FROM public.permisos_usuario_congregacion e
    WHERE e.user_id = uc.user_id AND e.congregacion_id = uc.congregacion_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.permisos_usuario_congregacion x
    WHERE x.user_id = uc.user_id AND x.congregacion_id = uc.congregacion_id
      AND x.modulo = 'predicacion_capitanes_movil'
  );

-- 4) Las funciones de Capitanes aceptan cualquiera de los dos permisos (quien
--    solo tiene el móvil también debe poder listar, agregar y quitar).
CREATE OR REPLACE FUNCTION public.get_capitanes_autorizados(_congregacion_id uuid)
RETURNS TABLE (
  participante_id uuid,
  nombre text,
  apellido text,
  tiene_usuario boolean,
  email text,
  cuenta_activa boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_permission(auth.uid(), _congregacion_id, 'predicacion_capitanes_lista', 'ver')
       OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_capitanes_movil', 'ver')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nombre, p.apellido,
         (p.user_id IS NOT NULL),
         CASE WHEN p.user_id IS NOT NULL
                   AND (NOT public.has_role(p.user_id, 'super_admin'::app_role)
                        OR public.has_role(auth.uid(), 'super_admin'::app_role))
              THEN pr.email END,
         uc.activo
  FROM public.participantes p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.usuarios_congregacion uc
         ON uc.user_id = p.user_id AND uc.congregacion_id = p.congregacion_id
  WHERE p.congregacion_id = _congregacion_id
    AND p.es_capitan_grupo = true
    AND p.activo = true
  ORDER BY p.apellido, p.nombre;
END;
$$;

CREATE OR REPLACE FUNCTION public.agregar_capitan_grupo(_participante_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p record;
BEGIN
  SELECT id, congregacion_id, genero, estado_aprobado, activo INTO _p
  FROM public.participantes WHERE id = _participante_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'participante_no_encontrado';
  END IF;

  IF NOT (public.has_permission(auth.uid(), _p.congregacion_id, 'predicacion_capitanes_lista', 'crear')
       OR public.has_permission(auth.uid(), _p.congregacion_id, 'predicacion_capitanes_movil', 'crear')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _p.genero IS DISTINCT FROM 'M' OR _p.estado_aprobado IS NOT TRUE OR _p.activo IS NOT TRUE THEN
    RAISE EXCEPTION 'solo_varones_aprobados';
  END IF;

  UPDATE public.participantes SET es_capitan_grupo = true WHERE id = _participante_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.quitar_capitan_grupo(_participante_id uuid, _reemplazos jsonb DEFAULT '[]'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cong uuid;
  _r jsonb;
  _nuevo uuid;
BEGIN
  SELECT congregacion_id INTO _cong FROM public.participantes WHERE id = _participante_id;
  IF _cong IS NULL THEN
    RAISE EXCEPTION 'participante_no_encontrado';
  END IF;

  IF NOT (public.has_permission(auth.uid(), _cong, 'predicacion_capitanes_lista', 'eliminar')
       OR public.has_permission(auth.uid(), _cong, 'predicacion_capitanes_movil', 'eliminar')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  FOR _r IN SELECT * FROM jsonb_array_elements(COALESCE(_reemplazos, '[]'::jsonb)) LOOP
    _nuevo := NULLIF(_r->>'nuevo_capitan_id', '')::uuid;

    IF _r->>'tipo' = 'programa' THEN
      UPDATE public.programa_predicacion pp
      SET capitan_id = CASE WHEN pp.capitan_id = _participante_id THEN _nuevo ELSE pp.capitan_id END,
          asignaciones_grupos = CASE
            WHEN pp.asignaciones_grupos IS NULL THEN NULL
            ELSE (
              SELECT COALESCE(jsonb_agg(
                CASE
                  WHEN e->>'capitan_id' = _participante_id::text THEN
                    CASE WHEN _nuevo IS NULL THEN e - 'capitan_id'
                         ELSE jsonb_set(e, '{capitan_id}', to_jsonb(_nuevo::text)) END
                  ELSE e
                END ORDER BY o), '[]'::jsonb)
              FROM jsonb_array_elements(pp.asignaciones_grupos) WITH ORDINALITY x(e, o)
            )
          END
      WHERE pp.id = (_r->>'id')::uuid AND pp.congregacion_id = _cong;

    ELSIF _r->>'tipo' = 'fija' THEN
      IF _nuevo IS NULL THEN
        UPDATE public.asignaciones_capitan_fijas SET activo = false
        WHERE id = (_r->>'id')::uuid AND congregacion_id = _cong;
      ELSE
        UPDATE public.asignaciones_capitan_fijas SET capitan_id = _nuevo
        WHERE id = (_r->>'id')::uuid AND congregacion_id = _cong;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.participantes SET es_capitan_grupo = false WHERE id = _participante_id;
END;
$$;
