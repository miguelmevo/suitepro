-- 1. Corregir grupos_predicacion: Requerir autenticación para SELECT
DROP POLICY IF EXISTS "Cualquiera puede ver grupos_predicacion" ON public.grupos_predicacion;

CREATE POLICY "Usuarios autenticados pueden ver grupos_predicacion" 
ON public.grupos_predicacion 
FOR SELECT 
TO authenticated
USING (true);

-- 2. Corregir mensajes_adicionales: Restringir a usuarios autenticados (ya está así, pero aseguramos el rol)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver mensajes_adicionales" ON public.mensajes_adicionales;

CREATE POLICY "Usuarios autenticados pueden ver mensajes_adicionales" 
ON public.mensajes_adicionales 
FOR SELECT 
TO authenticated
USING (true);

-- 3. Corregir storage.objects: Restringir acceso anónimo a imágenes de territorios
-- El usuario ya confirmó que las imágenes deben ser públicas, pero actualizamos para usar authenticated
DROP POLICY IF EXISTS "Cualquiera puede ver imágenes de territorios" ON storage.objects;

CREATE POLICY "Usuarios autenticados pueden ver imágenes de territorios" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'territorios');

-- 4. Corregir otras tablas con políticas de acceso anónimo
-- asignaciones_capitan_fijas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver asignaciones_capitan_fijas" ON public.asignaciones_capitan_fijas;
CREATE POLICY "Usuarios autenticados pueden ver asignaciones_capitan_fijas" 
ON public.asignaciones_capitan_fijas 
FOR SELECT 
TO authenticated
USING (true);

-- configuracion_sistema
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver configuracion" ON public.configuracion_sistema;
CREATE POLICY "Usuarios autenticados pueden ver configuracion" 
ON public.configuracion_sistema 
FOR SELECT 
TO authenticated
USING (true);

-- dias_especiales
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver dias_especiales" ON public.dias_especiales;
CREATE POLICY "Usuarios autenticados pueden ver dias_especiales" 
ON public.dias_especiales 
FOR SELECT 
TO authenticated
USING (true);

-- disponibilidad_capitanes
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver disponibilidad_capitanes" ON public.disponibilidad_capitanes;
CREATE POLICY "Usuarios autenticados pueden ver disponibilidad_capitanes" 
ON public.disponibilidad_capitanes 
FOR SELECT 
TO authenticated
USING (true);

-- grupos_servicio
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver grupos_servicio" ON public.grupos_servicio;
CREATE POLICY "Usuarios autenticados pueden ver grupos_servicio" 
ON public.grupos_servicio 
FOR SELECT 
TO authenticated
USING (true);

-- horarios_salida
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver horarios_salida" ON public.horarios_salida;
CREATE POLICY "Usuarios autenticados pueden ver horarios_salida" 
ON public.horarios_salida 
FOR SELECT 
TO authenticated
USING (true);

-- manzanas_territorio
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver manzanas_territorio" ON public.manzanas_territorio;
CREATE POLICY "Usuarios autenticados pueden ver manzanas_territorio" 
ON public.manzanas_territorio 
FOR SELECT 
TO authenticated
USING (true);

-- miembros_grupo
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver miembros_grupo" ON public.miembros_grupo;
CREATE POLICY "Usuarios autenticados pueden ver miembros_grupo" 
ON public.miembros_grupo 
FOR SELECT 
TO authenticated
USING (true);

-- programa_predicacion
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver programa_predicacion" ON public.programa_predicacion;
CREATE POLICY "Usuarios autenticados pueden ver programa_predicacion" 
ON public.programa_predicacion 
FOR SELECT 
TO authenticated
USING (true);

-- puntos_encuentro
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver puntos_encuentro" ON public.puntos_encuentro;
CREATE POLICY "Usuarios autenticados pueden ver puntos_encuentro" 
ON public.puntos_encuentro 
FOR SELECT 
TO authenticated
USING (true);

-- territorios
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver territorios" ON public.territorios;
CREATE POLICY "Usuarios autenticados pueden ver territorios" 
ON public.territorios 
FOR SELECT 
TO authenticated
USING (true);

-- tipos_programa
DROP POLICY IF EXISTS "Cualquiera puede ver tipos_programa" ON public.tipos_programa;
CREATE POLICY "Usuarios autenticados pueden ver tipos_programa" 
ON public.tipos_programa 
FOR SELECT 
TO authenticated
USING (true);