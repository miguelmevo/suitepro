-- Corregir políticas de INSERT/UPDATE/DELETE para requerir autenticación explícita

-- asignaciones_capitan_fijas
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar asignaciones_capitan_fijas" ON public.asignaciones_capitan_fijas;
DROP POLICY IF EXISTS "Admin y Editor pueden crear asignaciones_capitan_fijas" ON public.asignaciones_capitan_fijas;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar asignaciones_capitan_fijas" ON public.asignaciones_capitan_fijas;

CREATE POLICY "Admin y Editor pueden actualizar asignaciones_capitan_fijas" 
ON public.asignaciones_capitan_fijas FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear asignaciones_capitan_fijas" 
ON public.asignaciones_capitan_fijas FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar asignaciones_capitan_fijas" 
ON public.asignaciones_capitan_fijas FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- configuracion_sistema
DROP POLICY IF EXISTS "Admin y Editor pueden modificar configuracion" ON public.configuracion_sistema;

CREATE POLICY "Admin y Editor pueden modificar configuracion" 
ON public.configuracion_sistema FOR ALL TO authenticated
USING (is_admin_or_editor(auth.uid()))
WITH CHECK (is_admin_or_editor(auth.uid()));

-- dias_especiales
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar dias_especiales" ON public.dias_especiales;
DROP POLICY IF EXISTS "Admin y Editor pueden crear dias_especiales" ON public.dias_especiales;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar dias_especiales" ON public.dias_especiales;

CREATE POLICY "Admin y Editor pueden actualizar dias_especiales" 
ON public.dias_especiales FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear dias_especiales" 
ON public.dias_especiales FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar dias_especiales" 
ON public.dias_especiales FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- disponibilidad_capitanes
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar disponibilidad_capitanes" ON public.disponibilidad_capitanes;
DROP POLICY IF EXISTS "Admin y Editor pueden crear disponibilidad_capitanes" ON public.disponibilidad_capitanes;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar disponibilidad_capitanes" ON public.disponibilidad_capitanes;

CREATE POLICY "Admin y Editor pueden actualizar disponibilidad_capitanes" 
ON public.disponibilidad_capitanes FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear disponibilidad_capitanes" 
ON public.disponibilidad_capitanes FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar disponibilidad_capitanes" 
ON public.disponibilidad_capitanes FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- grupos_predicacion
DROP POLICY IF EXISTS "Admin y Editor pueden modificar grupos_predicacion" ON public.grupos_predicacion;

CREATE POLICY "Admin y Editor pueden modificar grupos_predicacion" 
ON public.grupos_predicacion FOR ALL TO authenticated
USING (is_admin_or_editor(auth.uid()))
WITH CHECK (is_admin_or_editor(auth.uid()));

-- grupos_servicio
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar grupos_servicio" ON public.grupos_servicio;
DROP POLICY IF EXISTS "Admin y Editor pueden crear grupos_servicio" ON public.grupos_servicio;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar grupos_servicio" ON public.grupos_servicio;

CREATE POLICY "Admin y Editor pueden actualizar grupos_servicio" 
ON public.grupos_servicio FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear grupos_servicio" 
ON public.grupos_servicio FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar grupos_servicio" 
ON public.grupos_servicio FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- horarios_salida
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar horarios_salida" ON public.horarios_salida;
DROP POLICY IF EXISTS "Admin y Editor pueden crear horarios_salida" ON public.horarios_salida;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar horarios_salida" ON public.horarios_salida;

CREATE POLICY "Admin y Editor pueden actualizar horarios_salida" 
ON public.horarios_salida FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear horarios_salida" 
ON public.horarios_salida FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar horarios_salida" 
ON public.horarios_salida FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- manzanas_territorio
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar manzanas_territorio" ON public.manzanas_territorio;
DROP POLICY IF EXISTS "Admin y Editor pueden crear manzanas_territorio" ON public.manzanas_territorio;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar manzanas_territorio" ON public.manzanas_territorio;

CREATE POLICY "Admin y Editor pueden actualizar manzanas_territorio" 
ON public.manzanas_territorio FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear manzanas_territorio" 
ON public.manzanas_territorio FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar manzanas_territorio" 
ON public.manzanas_territorio FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- mensajes_adicionales
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar mensajes_adicionales" ON public.mensajes_adicionales;
DROP POLICY IF EXISTS "Admin y Editor pueden crear mensajes_adicionales" ON public.mensajes_adicionales;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar mensajes_adicionales" ON public.mensajes_adicionales;

CREATE POLICY "Admin y Editor pueden actualizar mensajes_adicionales" 
ON public.mensajes_adicionales FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear mensajes_adicionales" 
ON public.mensajes_adicionales FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar mensajes_adicionales" 
ON public.mensajes_adicionales FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- miembros_grupo
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar miembros_grupo" ON public.miembros_grupo;
DROP POLICY IF EXISTS "Admin y Editor pueden crear miembros_grupo" ON public.miembros_grupo;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar miembros_grupo" ON public.miembros_grupo;

CREATE POLICY "Admin y Editor pueden actualizar miembros_grupo" 
ON public.miembros_grupo FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear miembros_grupo" 
ON public.miembros_grupo FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar miembros_grupo" 
ON public.miembros_grupo FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- participantes
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar participantes" ON public.participantes;
DROP POLICY IF EXISTS "Admin y Editor pueden crear participantes" ON public.participantes;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar participantes" ON public.participantes;
DROP POLICY IF EXISTS "Admin y Editor pueden ver todos los participantes" ON public.participantes;

CREATE POLICY "Admin y Editor pueden actualizar participantes" 
ON public.participantes FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear participantes" 
ON public.participantes FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar participantes" 
ON public.participantes FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden ver todos los participantes" 
ON public.participantes FOR SELECT TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- programa_predicacion
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar programa_predicacion" ON public.programa_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden crear programa_predicacion" ON public.programa_predicacion;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar programa_predicacion" ON public.programa_predicacion;

CREATE POLICY "Admin y Editor pueden actualizar programa_predicacion" 
ON public.programa_predicacion FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear programa_predicacion" 
ON public.programa_predicacion FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar programa_predicacion" 
ON public.programa_predicacion FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- puntos_encuentro
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar puntos_encuentro" ON public.puntos_encuentro;
DROP POLICY IF EXISTS "Admin y Editor pueden crear puntos_encuentro" ON public.puntos_encuentro;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar puntos_encuentro" ON public.puntos_encuentro;

CREATE POLICY "Admin y Editor pueden actualizar puntos_encuentro" 
ON public.puntos_encuentro FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear puntos_encuentro" 
ON public.puntos_encuentro FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar puntos_encuentro" 
ON public.puntos_encuentro FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- territorios
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar territorios" ON public.territorios;
DROP POLICY IF EXISTS "Admin y Editor pueden crear territorios" ON public.territorios;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar territorios" ON public.territorios;

CREATE POLICY "Admin y Editor pueden actualizar territorios" 
ON public.territorios FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear territorios" 
ON public.territorios FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar territorios" 
ON public.territorios FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- tipos_programa
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar tipos_programa" ON public.tipos_programa;
DROP POLICY IF EXISTS "Admin y Editor pueden crear tipos_programa" ON public.tipos_programa;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar tipos_programa" ON public.tipos_programa;

CREATE POLICY "Admin y Editor pueden actualizar tipos_programa" 
ON public.tipos_programa FOR UPDATE TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden crear tipos_programa" 
ON public.tipos_programa FOR INSERT TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar tipos_programa" 
ON public.tipos_programa FOR DELETE TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- storage.objects para territorios
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir imágenes" ON storage.objects;

CREATE POLICY "Usuarios autenticados pueden actualizar imágenes" 
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'territorios');

CREATE POLICY "Usuarios autenticados pueden eliminar imágenes" 
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'territorios');

CREATE POLICY "Usuarios autenticados pueden subir imágenes" 
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'territorios');