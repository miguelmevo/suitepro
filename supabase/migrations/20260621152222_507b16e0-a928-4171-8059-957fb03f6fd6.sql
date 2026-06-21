
-- 1) Restrict 'Usuarios con permisos granulares pueden ver participantes' policy
--    to ONLY grant SELECT when the granted permission is on 'configuracion_participantes'.
DROP POLICY IF EXISTS "Usuarios con permisos granulares pueden ver participantes" ON public.participantes;

CREATE POLICY "Usuarios con permisos granulares pueden ver participantes"
ON public.participantes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.permisos_usuario_congregacion p
    WHERE p.user_id = auth.uid()
      AND p.congregacion_id = participantes.congregacion_id
      AND p.modulo = 'configuracion_participantes'
      AND p.puede_ver = true
  )
);

-- 2) Remove public (unauthenticated) SELECT on programas-pdf bucket;
--    keep the authenticated-only policy in place.
DROP POLICY IF EXISTS "PDFs de programas son públicos" ON storage.objects;

-- 3) Harden storage_programa_congregacion_id() to verify the UUID matches a real congregation.
CREATE OR REPLACE FUNCTION public.storage_programa_congregacion_id(_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT c.id
  FROM public.congregaciones c
  WHERE c.id = NULLIF(split_part(_name, '/', 1), '')::uuid
  LIMIT 1
$function$;
