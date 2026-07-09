-- =====================================================
-- CORRECCIÓN COMPLETA DE SEGURIDAD RLS
-- =====================================================

-- 1. PARTICIPANTES: Crear vista segura para teléfonos
-- Primero crear función para verificar visibilidad de teléfonos
CREATE OR REPLACE FUNCTION public.get_participantes_seguros()
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  telefono text,
  estado_aprobado boolean,
  responsabilidad text[],
  responsabilidad_adicional text,
  grupo_predicacion_id uuid,
  restriccion_disponibilidad text,
  es_capitan_grupo boolean,
  activo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.nombre,
    p.apellido,
    CASE 
      WHEN is_admin_or_editor(auth.uid()) THEN p.telefono
      ELSE NULL
    END as telefono,
    p.estado_aprobado,
    p.responsabilidad,
    p.responsabilidad_adicional,
    p.grupo_predicacion_id,
    p.restriccion_disponibilidad,
    p.es_capitan_grupo,
    p.activo,
    p.created_at,
    p.updated_at
  FROM public.participantes p
  WHERE p.activo = true
$$;

-- 2. TIPOS_PROGRAMA: Restringir escritura a admin/editor
DROP POLICY IF EXISTS "Cualquiera puede crear tipos_programa" ON public.tipos_programa;
DROP POLICY IF EXISTS "Cualquiera puede actualizar tipos_programa" ON public.tipos_programa;
DROP POLICY IF EXISTS "Cualquiera puede eliminar tipos_programa" ON public.tipos_programa;

CREATE POLICY "Admin y Editor pueden crear tipos_programa"
ON public.tipos_programa
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar tipos_programa"
ON public.tipos_programa
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar tipos_programa"
ON public.tipos_programa
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- 3. PROGRAMA_PREDICACION: Restringir a usuarios autenticados y roles
DROP POLICY IF EXISTS "Acceso público programa_predicacion" ON public.programa_predicacion;

CREATE POLICY "Usuarios autenticados pueden ver programa_predicacion"
ON public.programa_predicacion
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin y Editor pueden crear programa_predicacion"
ON public.programa_predicacion
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar programa_predicacion"
ON public.programa_predicacion
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar programa_predicacion"
ON public.programa_predicacion
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- 4. TERRITORIOS: Restringir escritura a admin/editor
DROP POLICY IF EXISTS "Acceso público territorios" ON public.territorios;

CREATE POLICY "Usuarios autenticados pueden ver territorios"
ON public.territorios
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin y Editor pueden crear territorios"
ON public.territorios
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar territorios"
ON public.territorios
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar territorios"
ON public.territorios
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- 5. PUNTOS_ENCUENTRO: Restringir a usuarios autenticados
DROP POLICY IF EXISTS "Acceso público puntos_encuentro" ON public.puntos_encuentro;

CREATE POLICY "Usuarios autenticados pueden ver puntos_encuentro"
ON public.puntos_encuentro
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin y Editor pueden crear puntos_encuentro"
ON public.puntos_encuentro
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar puntos_encuentro"
ON public.puntos_encuentro
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar puntos_encuentro"
ON public.puntos_encuentro
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- 6. HORARIOS_SALIDA: Restringir escritura a admin/editor
DROP POLICY IF EXISTS "Acceso público horarios_salida" ON public.horarios_salida;

CREATE POLICY "Usuarios autenticados pueden ver horarios_salida"
ON public.horarios_salida
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin y Editor pueden crear horarios_salida"
ON public.horarios_salida
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar horarios_salida"
ON public.horarios_salida
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar horarios_salida"
ON public.horarios_salida
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- 7. DIAS_ESPECIALES: Restringir a usuarios autenticados
DROP POLICY IF EXISTS "Acceso público dias_especiales" ON public.dias_especiales;

CREATE POLICY "Usuarios autenticados pueden ver dias_especiales"
ON public.dias_especiales
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin y Editor pueden crear dias_especiales"
ON public.dias_especiales
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar dias_especiales"
ON public.dias_especiales
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar dias_especiales"
ON public.dias_especiales
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- 8. MANZANAS_TERRITORIO: Restringir a usuarios autenticados
DROP POLICY IF EXISTS "Acceso público manzanas_territorio" ON public.manzanas_territorio;

CREATE POLICY "Usuarios autenticados pueden ver manzanas_territorio"
ON public.manzanas_territorio
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin y Editor pueden crear manzanas_territorio"
ON public.manzanas_territorio
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar manzanas_territorio"
ON public.manzanas_territorio
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar manzanas_territorio"
ON public.manzanas_territorio
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- 9. CONFIGURACION_SISTEMA: Restringir lectura a usuarios autenticados
DROP POLICY IF EXISTS "Cualquiera puede ver configuracion" ON public.configuracion_sistema;

CREATE POLICY "Usuarios autenticados pueden ver configuracion"
ON public.configuracion_sistema
FOR SELECT
TO authenticated
USING (true);