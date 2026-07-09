CREATE OR REPLACE FUNCTION public.get_participantes_seguros(_congregacion_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, nombre text, apellido text, telefono text, estado_aprobado boolean, responsabilidad text[], responsabilidad_adicional text, grupo_predicacion_id uuid, restriccion_disponibilidad text, es_capitan_grupo boolean, es_publicador_inactivo boolean, activo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, genero text, es_casado boolean, tiene_hijos boolean, inscrito_emc boolean, alias text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    p.id, p.nombre, p.apellido,
    CASE 
      WHEN public.has_permission(auth.uid(), p.congregacion_id, 'configuracion_participantes', 'ver') THEN p.telefono
      ELSE NULL
    END as telefono,
    p.estado_aprobado, p.responsabilidad, p.responsabilidad_adicional, p.grupo_predicacion_id,
    p.restriccion_disponibilidad, p.es_capitan_grupo, p.es_publicador_inactivo,
    p.activo, p.created_at, p.updated_at, p.user_id, p.genero,
    p.es_casado, p.tiene_hijos, p.inscrito_emc, p.alias
  FROM public.participantes p
  WHERE p.congregacion_id = COALESCE(_congregacion_id, get_user_congregacion_id())
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_predicacion(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion
    WHERE user_id = auth.uid()
      AND congregacion_id = _congregacion_id
      AND rol IN ('admin','editor','super_admin','sservicio')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_programa', 'editar')
  OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_programa', 'crear')
  OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_capitanes', 'editar')
  OR public.has_permission(auth.uid(), _congregacion_id, 'predicacion_capitanes', 'crear');
$function$;

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar territorios de su congregación" ON public.territorios;
DROP POLICY IF EXISTS "Admin y Editor pueden crear territorios en su congregación" ON public.territorios;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar territorios de su congregación" ON public.territorios;
CREATE POLICY "Usuarios con permiso pueden actualizar territorios en su congregación"
ON public.territorios
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear territorios en su congregación"
ON public.territorios
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'crear'));
CREATE POLICY "Usuarios con permiso pueden eliminar territorios en su congregación"
ON public.territorios
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'eliminar'));

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar asignaciones territorio-grupo" ON public.territorios_grupos_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden crear asignaciones territorio-grupo" ON public.territorios_grupos_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar asignaciones territorio-grupo" ON public.territorios_grupos_predicacion;
CREATE POLICY "Usuarios con permiso pueden actualizar asignaciones territorio-grupo"
ON public.territorios_grupos_predicacion
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear asignaciones territorio-grupo"
ON public.territorios_grupos_predicacion
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));
CREATE POLICY "Usuarios con permiso pueden eliminar asignaciones territorio-grupo"
ON public.territorios_grupos_predicacion
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar manzanas de su congregación" ON public.manzanas_territorio;
DROP POLICY IF EXISTS "Admin y Editor pueden crear manzanas en su congregación" ON public.manzanas_territorio;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar manzanas de su congregación" ON public.manzanas_territorio;
CREATE POLICY "Usuarios con permiso pueden actualizar manzanas en su congregación"
ON public.manzanas_territorio
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear manzanas en su congregación"
ON public.manzanas_territorio
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));
CREATE POLICY "Usuarios con permiso pueden eliminar manzanas en su congregación"
ON public.manzanas_territorio
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));

DROP POLICY IF EXISTS "Admin/Editor pueden actualizar direcciones bloqueadas" ON public.direcciones_bloqueadas;
DROP POLICY IF EXISTS "Admin/Editor pueden insertar direcciones bloqueadas" ON public.direcciones_bloqueadas;
DROP POLICY IF EXISTS "Admin/Editor pueden eliminar direcciones bloqueadas" ON public.direcciones_bloqueadas;
CREATE POLICY "Usuarios con permiso pueden actualizar direcciones bloqueadas"
ON public.direcciones_bloqueadas
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear direcciones bloqueadas"
ON public.direcciones_bloqueadas
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));
CREATE POLICY "Usuarios con permiso pueden eliminar direcciones bloqueadas"
ON public.direcciones_bloqueadas
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar puntos de encuentro de su congregación" ON public.puntos_encuentro;
DROP POLICY IF EXISTS "Admin y Editor pueden crear puntos de encuentro en su congregación" ON public.puntos_encuentro;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar puntos de encuentro de su congregación" ON public.puntos_encuentro;
CREATE POLICY "Usuarios con permiso pueden actualizar puntos de encuentro en su congregación"
ON public.puntos_encuentro
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_puntos', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_puntos', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear puntos de encuentro en su congregación"
ON public.puntos_encuentro
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_puntos', 'crear'));
CREATE POLICY "Usuarios con permiso pueden eliminar puntos de encuentro en su congregación"
ON public.puntos_encuentro
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_puntos', 'eliminar'));

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar carritos de su congregación" ON public.carritos;
DROP POLICY IF EXISTS "Admin y Editor pueden crear carritos en su congregación" ON public.carritos;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar carritos de su congregación" ON public.carritos;
CREATE POLICY "Usuarios con permiso pueden actualizar carritos en su congregación"
ON public.carritos
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_carritos', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_carritos', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear carritos en su congregación"
ON public.carritos
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_carritos', 'crear'));
CREATE POLICY "Usuarios con permiso pueden eliminar carritos en su congregación"
ON public.carritos
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_carritos', 'eliminar'));

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar disponibilidad de su congregación" ON public.disponibilidad_capitanes;
DROP POLICY IF EXISTS "Admin y Editor pueden crear disponibilidad en su congregación" ON public.disponibilidad_capitanes;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar disponibilidad de su congregación" ON public.disponibilidad_capitanes;
CREATE POLICY "Usuarios con permiso pueden actualizar disponibilidad de capitanes"
ON public.disponibilidad_capitanes
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_capitanes', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_capitanes', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear disponibilidad de capitanes"
ON public.disponibilidad_capitanes
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_capitanes', 'crear'));
CREATE POLICY "Usuarios con permiso pueden eliminar disponibilidad de capitanes"
ON public.disponibilidad_capitanes
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_capitanes', 'eliminar'));

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar asignaciones fijas de su congr" ON public.asignaciones_capitan_fijas;
DROP POLICY IF EXISTS "Admin y Editor pueden crear asignaciones fijas en su congregaci" ON public.asignaciones_capitan_fijas;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar asignaciones fijas de su congreg" ON public.asignaciones_capitan_fijas;
CREATE POLICY "Usuarios con permiso pueden actualizar asignaciones fijas"
ON public.asignaciones_capitan_fijas
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_capitanes', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_capitanes', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear asignaciones fijas"
ON public.asignaciones_capitan_fijas
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_capitanes', 'crear'));
CREATE POLICY "Usuarios con permiso pueden eliminar asignaciones fijas"
ON public.asignaciones_capitan_fijas
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_capitanes', 'eliminar'));

DROP POLICY IF EXISTS "Admin y Editor pueden gestionar ciclos" ON public.ciclos_territorio;
DROP POLICY IF EXISTS "Capitanes pueden crear ciclos en su congregación" ON public.ciclos_territorio;
CREATE POLICY "Usuarios con permiso pueden gestionar ciclos de territorios"
ON public.ciclos_territorio
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'editar')
  OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'eliminar')
)
WITH CHECK (
  public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'editar')
  OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'crear')
);
CREATE POLICY "Capitanes pueden crear ciclos en su congregación"
ON public.ciclos_territorio
FOR INSERT
TO authenticated
WITH CHECK (is_capitan_in_congregacion(congregacion_id));

DROP POLICY IF EXISTS "Admin y Editor pueden gestionar manzanas trabajadas" ON public.manzanas_trabajadas;
DROP POLICY IF EXISTS "Capitanes pueden registrar manzanas trabajadas" ON public.manzanas_trabajadas;
DROP POLICY IF EXISTS "Capitanes pueden eliminar sus propios registros" ON public.manzanas_trabajadas;
CREATE POLICY "Usuarios con permiso pueden gestionar manzanas trabajadas"
ON public.manzanas_trabajadas
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'editar')
  OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'eliminar')
)
WITH CHECK (
  (
    public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'editar')
    OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'crear')
  )
  AND (marcado_por = auth.uid() OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios_historial', 'editar'))
);
CREATE POLICY "Capitanes pueden registrar manzanas trabajadas"
ON public.manzanas_trabajadas
FOR INSERT
TO authenticated
WITH CHECK (is_capitan_in_congregacion(congregacion_id) AND marcado_por = auth.uid());
CREATE POLICY "Capitanes pueden eliminar sus propios registros"
ON public.manzanas_trabajadas
FOR DELETE
TO authenticated
USING ((marcado_por = auth.uid()) AND is_capitan_in_congregacion(congregacion_id));

DROP POLICY IF EXISTS "Admin y Editor pueden modificar configuración de su congregación" ON public.configuracion_sistema;
CREATE POLICY "Usuarios con permiso pueden modificar configuraciones generales"
ON public.configuracion_sistema
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (programa_tipo = 'general' AND public.has_permission(auth.uid(), congregacion_id, 'ajustes_general', 'editar'))
  OR (programa_tipo = 'asignaciones' AND public.has_permission(auth.uid(), congregacion_id, 'ajustes_asignaciones', 'editar'))
  OR (programa_tipo = 'predicacion' AND public.has_permission(auth.uid(), congregacion_id, 'ajustes_predicacion', 'editar'))
)
WITH CHECK (
  (programa_tipo = 'general' AND public.has_permission(auth.uid(), congregacion_id, 'ajustes_general', 'editar'))
  OR (programa_tipo = 'asignaciones' AND public.has_permission(auth.uid(), congregacion_id, 'ajustes_asignaciones', 'editar'))
  OR (programa_tipo = 'predicacion' AND public.has_permission(auth.uid(), congregacion_id, 'ajustes_predicacion', 'editar'))
);

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar días especiales de su congregación" ON public.dias_especiales;
DROP POLICY IF EXISTS "Admin y Editor pueden crear días especiales en su congregación" ON public.dias_especiales;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar días especiales de su congregación" ON public.dias_especiales;
CREATE POLICY "Usuarios con permiso pueden actualizar días especiales"
ON public.dias_especiales
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'configuracion_dias_especiales', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'configuracion_dias_especiales', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear días especiales"
ON public.dias_especiales
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'configuracion_dias_especiales', 'crear'));
CREATE POLICY "Usuarios con permiso pueden eliminar días especiales"
ON public.dias_especiales
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'configuracion_dias_especiales', 'eliminar'));

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar indisponibilidad de su congregación" ON public.indisponibilidad_participantes;
DROP POLICY IF EXISTS "Admin y Editor pueden crear indisponibilidad en su congregación" ON public.indisponibilidad_participantes;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar indisponibilidad de su congregación" ON public.indisponibilidad_participantes;
CREATE POLICY "Usuarios con permiso pueden actualizar indisponibilidad de participantes"
ON public.indisponibilidad_participantes
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'configuracion_dias_especiales', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'configuracion_dias_especiales', 'editar'));
CREATE POLICY "Usuarios con permiso pueden crear indisponibilidad de participantes"
ON public.indisponibilidad_participantes
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'configuracion_dias_especiales', 'crear'));
CREATE POLICY "Usuarios con permiso pueden eliminar indisponibilidad de participantes"
ON public.indisponibilidad_participantes
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'configuracion_dias_especiales', 'eliminar'));

DROP POLICY IF EXISTS "Users can update own indisponibilidad" ON public.indisponibilidad_participantes;
DROP POLICY IF EXISTS "Users can create own indisponibilidad" ON public.indisponibilidad_participantes;
DROP POLICY IF EXISTS "Users can delete own indisponibilidad" ON public.indisponibilidad_participantes;
CREATE POLICY "Usuarios pueden crear su propia indisponibilidad"
ON public.indisponibilidad_participantes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.participantes p
    WHERE p.id = indisponibilidad_participantes.participante_id
      AND p.user_id = auth.uid()
      AND p.activo = true
  )
);
CREATE POLICY "Usuarios pueden actualizar su propia indisponibilidad"
ON public.indisponibilidad_participantes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.participantes p
    WHERE p.id = indisponibilidad_participantes.participante_id
      AND p.user_id = auth.uid()
      AND p.activo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.participantes p
    WHERE p.id = indisponibilidad_participantes.participante_id
      AND p.user_id = auth.uid()
      AND p.activo = true
  )
);
CREATE POLICY "Usuarios pueden eliminar su propia indisponibilidad"
ON public.indisponibilidad_participantes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.participantes p
    WHERE p.id = indisponibilidad_participantes.participante_id
      AND p.user_id = auth.uid()
      AND p.activo = true
  )
);

CREATE POLICY "Usuarios con permiso pueden actualizar color de congregación"
ON public.congregaciones
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), id, 'ajustes_general', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), id, 'ajustes_general', 'editar'));

DROP POLICY IF EXISTS "Admin y Editor pueden modificar grupos de predicación de su congregación" ON public.grupos_predicacion;
CREATE POLICY "Usuarios con permiso pueden gestionar grupos de predicación"
ON public.grupos_predicacion
FOR ALL
TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'configuracion_grupos', 'editar'))
WITH CHECK (
  public.has_permission(auth.uid(), congregacion_id, 'configuracion_grupos', 'editar')
  OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_grupos', 'crear')
);