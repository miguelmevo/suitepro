-- Ajustes para hoy (Asignaciones de Servicio): cambios puntuales de un día que, al aceptarse,
-- se muestran a todos por encima del programa del mes SIN modificarlo.
-- Permiso nuevo: asignaciones_servicio_ajustes (binario, solo "ver").

CREATE TABLE IF NOT EXISTS public.asignaciones_servicio_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregacion_id uuid NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo_asignacion public.tipo_asignacion_servicio NOT NULL,
  participante_id uuid REFERENCES public.participantes(id) ON DELETE SET NULL,
  grupo_predicacion_id uuid REFERENCES public.grupos_predicacion(id) ON DELETE SET NULL,
  ajustado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (congregacion_id, fecha, tipo_asignacion)
);

CREATE INDEX IF NOT EXISTS asig_servicio_ajustes_fecha_idx ON public.asignaciones_servicio_ajustes (congregacion_id, fecha);

ALTER TABLE public.asignaciones_servicio_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asig_servicio_ajustes_select" ON public.asignaciones_servicio_ajustes
  FOR SELECT TO authenticated USING (public.user_has_access_to_congregacion(congregacion_id));
-- Sin políticas de escritura: solo se escribe con guardar_ajustes_servicio_dia.

-- Reemplaza todos los ajustes de una fecha por los indicados.
-- _ajustes = [{"tipo":"audio","participante_id":"...","grupo_id":null}, ...]
CREATE OR REPLACE FUNCTION public.guardar_ajustes_servicio_dia(_congregacion_id uuid, _fecha date, _ajustes jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _a jsonb;
  _pid uuid;
  _gid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission(auth.uid(), _congregacion_id, 'asignaciones_servicio_ajustes', 'ver') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.asignaciones_servicio_ajustes WHERE congregacion_id = _congregacion_id AND fecha = _fecha;

  FOR _a IN SELECT * FROM jsonb_array_elements(COALESCE(_ajustes, '[]'::jsonb)) LOOP
    _pid := NULLIF(_a->>'participante_id', '')::uuid;
    _gid := NULLIF(_a->>'grupo_id', '')::uuid;
    IF _pid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.participantes WHERE id = _pid AND congregacion_id = _congregacion_id) THEN
      RAISE EXCEPTION 'participante_invalido';
    END IF;
    IF _gid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.grupos_predicacion WHERE id = _gid AND congregacion_id = _congregacion_id) THEN
      RAISE EXCEPTION 'grupo_invalido';
    END IF;
    INSERT INTO public.asignaciones_servicio_ajustes (congregacion_id, fecha, tipo_asignacion, participante_id, grupo_predicacion_id, ajustado_por)
    VALUES (_congregacion_id, _fecha, (_a->>'tipo')::public.tipo_asignacion_servicio, _pid, _gid, auth.uid());
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_ajustes_servicio_dia(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_ajustes_servicio_dia(uuid, date, jsonb) TO authenticated;

-- Vista pública (sin login), igual que el resto de la página pública de Inicio.
CREATE OR REPLACE FUNCTION public.get_ajustes_servicio_publico(_congregacion_id uuid, _desde date, _hasta date)
RETURNS TABLE (fecha date, tipo_asignacion text, participante_id uuid, grupo_predicacion_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.fecha, a.tipo_asignacion::text, a.participante_id, a.grupo_predicacion_id
  FROM public.asignaciones_servicio_ajustes a
  JOIN public.congregaciones c ON c.id = a.congregacion_id AND c.activo = true
  WHERE a.congregacion_id = _congregacion_id AND a.fecha >= _desde AND a.fecha <= _hasta;
$$;

GRANT EXECUTE ON FUNCTION public.get_ajustes_servicio_publico(uuid, date, date) TO anon, authenticated;

-- El módulo nuevo se expone al frontend.
CREATE OR REPLACE FUNCTION public.get_my_permissions(_congregacion_id uuid)
 RETURNS TABLE(modulo text, puede_ver boolean, puede_crear boolean, puede_editar boolean, puede_eliminar boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'cierre_vym','cierre_reunion_publica','cierre_asignaciones_servicio','cierre_predicacion',
    'asignaciones_servicio_ajustes'
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

-- Administrador (perfil de sistema) con el permiso nuevo.
UPDATE public.perfiles_permisos
SET permisos = permisos || jsonb_build_object('asignaciones_servicio_ajustes', '{"ver":true,"crear":true,"editar":true,"eliminar":true}'::jsonb)
WHERE es_sistema = true AND app_role = 'admin';

-- Administradores con permisos explícitos por usuario.
INSERT INTO public.permisos_usuario_congregacion
  (user_id, congregacion_id, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar)
SELECT DISTINCT uc.user_id, uc.congregacion_id, 'asignaciones_servicio_ajustes', true, true, true, true
FROM public.usuarios_congregacion uc
WHERE uc.rol = 'admin' AND uc.activo = true
  AND EXISTS (
    SELECT 1 FROM public.permisos_usuario_congregacion e
    WHERE e.user_id = uc.user_id AND e.congregacion_id = uc.congregacion_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.permisos_usuario_congregacion x
    WHERE x.user_id = uc.user_id AND x.congregacion_id = uc.congregacion_id
      AND x.modulo = 'asignaciones_servicio_ajustes'
  );
