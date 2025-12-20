-- Corregir RLS de participantes
DROP POLICY IF EXISTS "Cualquiera puede ver participantes" ON public.participantes;
DROP POLICY IF EXISTS "Cualquiera puede crear participantes" ON public.participantes;
DROP POLICY IF EXISTS "Cualquiera puede actualizar participantes" ON public.participantes;
DROP POLICY IF EXISTS "Cualquiera puede eliminar participantes" ON public.participantes;

-- Solo usuarios autenticados pueden ver participantes
CREATE POLICY "Usuarios autenticados pueden ver participantes"
ON public.participantes
FOR SELECT
TO authenticated
USING (true);

-- Solo admin/editor pueden modificar participantes
CREATE POLICY "Admin y Editor pueden crear participantes"
ON public.participantes
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar participantes"
ON public.participantes
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar participantes"
ON public.participantes
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- Corregir RLS de grupos_servicio
DROP POLICY IF EXISTS "Cualquiera puede ver grupos" ON public.grupos_servicio;
DROP POLICY IF EXISTS "Cualquiera puede crear grupos" ON public.grupos_servicio;
DROP POLICY IF EXISTS "Cualquiera puede actualizar grupos" ON public.grupos_servicio;
DROP POLICY IF EXISTS "Cualquiera puede eliminar grupos" ON public.grupos_servicio;

-- Solo usuarios autenticados pueden ver grupos
CREATE POLICY "Usuarios autenticados pueden ver grupos_servicio"
ON public.grupos_servicio
FOR SELECT
TO authenticated
USING (true);

-- Solo admin/editor pueden modificar grupos
CREATE POLICY "Admin y Editor pueden crear grupos_servicio"
ON public.grupos_servicio
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar grupos_servicio"
ON public.grupos_servicio
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar grupos_servicio"
ON public.grupos_servicio
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

-- Corregir RLS de miembros_grupo
DROP POLICY IF EXISTS "Cualquiera puede ver miembros" ON public.miembros_grupo;
DROP POLICY IF EXISTS "Cualquiera puede crear miembros" ON public.miembros_grupo;
DROP POLICY IF EXISTS "Cualquiera puede actualizar miembros" ON public.miembros_grupo;
DROP POLICY IF EXISTS "Cualquiera puede eliminar miembros" ON public.miembros_grupo;

-- Solo usuarios autenticados pueden ver miembros
CREATE POLICY "Usuarios autenticados pueden ver miembros_grupo"
ON public.miembros_grupo
FOR SELECT
TO authenticated
USING (true);

-- Solo admin/editor pueden modificar miembros
CREATE POLICY "Admin y Editor pueden crear miembros_grupo"
ON public.miembros_grupo
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar miembros_grupo"
ON public.miembros_grupo
FOR UPDATE
TO authenticated
USING (is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar miembros_grupo"
ON public.miembros_grupo
FOR DELETE
TO authenticated
USING (is_admin_or_editor(auth.uid()));