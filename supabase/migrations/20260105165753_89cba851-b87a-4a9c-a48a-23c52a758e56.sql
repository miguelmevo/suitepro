-- Fase 5: Actualizar políticas RLS para filtrar por congregación

-- ============================================
-- 1. PARTICIPANTES
-- ============================================
DROP POLICY IF EXISTS "Admin y Editor pueden ver todos los participantes" ON public.participantes;
DROP POLICY IF EXISTS "Admin y Editor pueden crear participantes" ON public.participantes;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar participantes" ON public.participantes;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar participantes" ON public.participantes;

CREATE POLICY "Admin y Editor pueden ver participantes de su congregación"
ON public.participantes FOR SELECT
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear participantes en su congregación"
ON public.participantes FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar participantes de su congregación"
ON public.participantes FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar participantes de su congregación"
ON public.participantes FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 2. PROGRAMA_PREDICACION
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver programa_predicacion" ON public.programa_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden crear programa_predicacion" ON public.programa_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar programa_predicacion" ON public.programa_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar programa_predicacion" ON public.programa_predicacion;

CREATE POLICY "Usuarios pueden ver programa de su congregación"
ON public.programa_predicacion FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear programa en su congregación"
ON public.programa_predicacion FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar programa de su congregación"
ON public.programa_predicacion FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar programa de su congregación"
ON public.programa_predicacion FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 3. TERRITORIOS
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver territorios" ON public.territorios;
DROP POLICY IF EXISTS "Admin y Editor pueden crear territorios" ON public.territorios;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar territorios" ON public.territorios;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar territorios" ON public.territorios;

CREATE POLICY "Usuarios pueden ver territorios de su congregación"
ON public.territorios FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear territorios en su congregación"
ON public.territorios FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar territorios de su congregación"
ON public.territorios FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar territorios de su congregación"
ON public.territorios FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 4. PUNTOS_ENCUENTRO
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver puntos_encuentro" ON public.puntos_encuentro;
DROP POLICY IF EXISTS "Admin y Editor pueden crear puntos_encuentro" ON public.puntos_encuentro;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar puntos_encuentro" ON public.puntos_encuentro;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar puntos_encuentro" ON public.puntos_encuentro;

CREATE POLICY "Usuarios pueden ver puntos de encuentro de su congregación"
ON public.puntos_encuentro FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear puntos de encuentro en su congregación"
ON public.puntos_encuentro FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar puntos de encuentro de su congregación"
ON public.puntos_encuentro FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar puntos de encuentro de su congregación"
ON public.puntos_encuentro FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 5. HORARIOS_SALIDA
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver horarios_salida" ON public.horarios_salida;
DROP POLICY IF EXISTS "Admin y Editor pueden crear horarios_salida" ON public.horarios_salida;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar horarios_salida" ON public.horarios_salida;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar horarios_salida" ON public.horarios_salida;

CREATE POLICY "Usuarios pueden ver horarios de su congregación"
ON public.horarios_salida FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear horarios en su congregación"
ON public.horarios_salida FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar horarios de su congregación"
ON public.horarios_salida FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar horarios de su congregación"
ON public.horarios_salida FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 6. DIAS_ESPECIALES
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver dias_especiales" ON public.dias_especiales;
DROP POLICY IF EXISTS "Admin y Editor pueden crear dias_especiales" ON public.dias_especiales;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar dias_especiales" ON public.dias_especiales;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar dias_especiales" ON public.dias_especiales;

CREATE POLICY "Usuarios pueden ver días especiales de su congregación"
ON public.dias_especiales FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear días especiales en su congregación"
ON public.dias_especiales FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar días especiales de su congregación"
ON public.dias_especiales FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar días especiales de su congregación"
ON public.dias_especiales FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 7. GRUPOS_PREDICACION
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver grupos_predicacion" ON public.grupos_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden modificar grupos_predicacion" ON public.grupos_predicacion;

CREATE POLICY "Usuarios pueden ver grupos de predicación de su congregación"
ON public.grupos_predicacion FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden modificar grupos de predicación de su congregación"
ON public.grupos_predicacion FOR ALL
USING (is_admin_or_editor_in_congregacion(congregacion_id))
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 8. GRUPOS_SERVICIO
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver grupos_servicio" ON public.grupos_servicio;
DROP POLICY IF EXISTS "Admin y Editor pueden crear grupos_servicio" ON public.grupos_servicio;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar grupos_servicio" ON public.grupos_servicio;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar grupos_servicio" ON public.grupos_servicio;

CREATE POLICY "Usuarios pueden ver grupos de servicio de su congregación"
ON public.grupos_servicio FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear grupos de servicio en su congregación"
ON public.grupos_servicio FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar grupos de servicio de su congregación"
ON public.grupos_servicio FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar grupos de servicio de su congregación"
ON public.grupos_servicio FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 9. MIEMBROS_GRUPO
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver miembros_grupo" ON public.miembros_grupo;
DROP POLICY IF EXISTS "Admin y Editor pueden crear miembros_grupo" ON public.miembros_grupo;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar miembros_grupo" ON public.miembros_grupo;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar miembros_grupo" ON public.miembros_grupo;

CREATE POLICY "Usuarios pueden ver miembros de grupo de su congregación"
ON public.miembros_grupo FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear miembros de grupo en su congregación"
ON public.miembros_grupo FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar miembros de grupo de su congregación"
ON public.miembros_grupo FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar miembros de grupo de su congregación"
ON public.miembros_grupo FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 10. MANZANAS_TERRITORIO
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver manzanas_territorio" ON public.manzanas_territorio;
DROP POLICY IF EXISTS "Admin y Editor pueden crear manzanas_territorio" ON public.manzanas_territorio;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar manzanas_territorio" ON public.manzanas_territorio;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar manzanas_territorio" ON public.manzanas_territorio;

CREATE POLICY "Usuarios pueden ver manzanas de su congregación"
ON public.manzanas_territorio FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear manzanas en su congregación"
ON public.manzanas_territorio FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar manzanas de su congregación"
ON public.manzanas_territorio FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar manzanas de su congregación"
ON public.manzanas_territorio FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 11. CONFIGURACION_SISTEMA
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver configuracion" ON public.configuracion_sistema;
DROP POLICY IF EXISTS "Admin y Editor pueden modificar configuracion" ON public.configuracion_sistema;

CREATE POLICY "Usuarios pueden ver configuración de su congregación"
ON public.configuracion_sistema FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden modificar configuración de su congregación"
ON public.configuracion_sistema FOR ALL
USING (is_admin_or_editor_in_congregacion(congregacion_id))
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 12. MENSAJES_ADICIONALES
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver mensajes_adicionales" ON public.mensajes_adicionales;
DROP POLICY IF EXISTS "Admin y Editor pueden crear mensajes_adicionales" ON public.mensajes_adicionales;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar mensajes_adicionales" ON public.mensajes_adicionales;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar mensajes_adicionales" ON public.mensajes_adicionales;

CREATE POLICY "Usuarios pueden ver mensajes de su congregación"
ON public.mensajes_adicionales FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear mensajes en su congregación"
ON public.mensajes_adicionales FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar mensajes de su congregación"
ON public.mensajes_adicionales FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar mensajes de su congregación"
ON public.mensajes_adicionales FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 13. DISPONIBILIDAD_CAPITANES
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver disponibilidad_capitanes" ON public.disponibilidad_capitanes;
DROP POLICY IF EXISTS "Admin y Editor pueden crear disponibilidad_capitanes" ON public.disponibilidad_capitanes;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar disponibilidad_capitanes" ON public.disponibilidad_capitanes;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar disponibilidad_capitanes" ON public.disponibilidad_capitanes;

CREATE POLICY "Usuarios pueden ver disponibilidad de capitanes de su congregación"
ON public.disponibilidad_capitanes FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear disponibilidad en su congregación"
ON public.disponibilidad_capitanes FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar disponibilidad de su congregación"
ON public.disponibilidad_capitanes FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar disponibilidad de su congregación"
ON public.disponibilidad_capitanes FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 14. ASIGNACIONES_CAPITAN_FIJAS
-- ============================================
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver asignaciones_capitan_fijas" ON public.asignaciones_capitan_fijas;
DROP POLICY IF EXISTS "Admin y Editor pueden crear asignaciones_capitan_fijas" ON public.asignaciones_capitan_fijas;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar asignaciones_capitan_fijas" ON public.asignaciones_capitan_fijas;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar asignaciones_capitan_fijas" ON public.asignaciones_capitan_fijas;

CREATE POLICY "Usuarios pueden ver asignaciones fijas de su congregación"
ON public.asignaciones_capitan_fijas FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear asignaciones fijas en su congregación"
ON public.asignaciones_capitan_fijas FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar asignaciones fijas de su congregación"
ON public.asignaciones_capitan_fijas FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar asignaciones fijas de su congregación"
ON public.asignaciones_capitan_fijas FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- ============================================
-- 15. PROGRAMAS_PUBLICADOS
-- ============================================
DROP POLICY IF EXISTS "Programas publicados son públicos" ON public.programas_publicados;
DROP POLICY IF EXISTS "Admin y Editor pueden publicar programas" ON public.programas_publicados;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar programas publicados" ON public.programas_publicados;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar programas publicados" ON public.programas_publicados;

CREATE POLICY "Usuarios pueden ver programas publicados de su congregación"
ON public.programas_publicados FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden publicar programas en su congregación"
ON public.programas_publicados FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar programas publicados de su congregación"
ON public.programas_publicados FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar programas publicados de su congregación"
ON public.programas_publicados FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));