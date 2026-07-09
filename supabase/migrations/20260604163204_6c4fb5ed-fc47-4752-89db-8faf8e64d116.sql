
-- 1) Fix DELETE policy on congregaciones: remove global has_role('admin') bypass
DROP POLICY IF EXISTS "Admin de congregación puede eliminar su congregación" ON public.congregaciones;
CREATE POLICY "Admin de congregación puede eliminar su congregación"
ON public.congregaciones
FOR DELETE
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = congregaciones.id
      AND uc.rol = 'admin'::app_role
      AND uc.activo = true
  )
);

-- 2) Extend SELECT on participantes so department roles can read their congregation's participants
DROP POLICY IF EXISTS "Solo admin/editor pueden leer participantes directamente" ON public.participantes;
CREATE POLICY "Roles autorizados leen participantes de su congregación"
ON public.participantes
FOR SELECT
USING (
  congregacion_id = get_user_congregacion_id()
  AND (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_role_in_congregacion(congregacion_id, 'sservicio'::app_role)
    OR has_role_in_congregacion(congregacion_id, 'srpublica'::app_role)
    OR has_role_in_congregacion(congregacion_id, 'svministerio'::app_role)
    OR has_role_in_congregacion(congregacion_id, 'saservicio'::app_role)
  )
);

-- 3) Harden storage_territorio_congregacion_id to verify full filename matches a real territory
CREATE OR REPLACE FUNCTION public.storage_territorio_congregacion_id(_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT t.congregacion_id
  FROM public.territorios t
  WHERE t.congregacion_id::text = split_part(split_part(_name, '/', 2), '_', 1)
    AND ('TERR' || t.numero) = split_part(
      regexp_replace(split_part(_name, '/', 2), '\.[^.]+$', ''),
      '_', 2
    )
  LIMIT 1;
$function$;
