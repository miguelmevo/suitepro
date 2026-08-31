-- Bucket dedicado para el plano general de territorios (un solo archivo por
-- congregación). No reutiliza el bucket "territorios" porque ese exige que el
-- nombre del archivo coincida con un territorio real existente
-- (storage_territorio_congregacion_id valida "TERR{numero}"), lo que bloquea
-- cualquier archivo que no sea la imagen de un territorio individual.

INSERT INTO storage.buckets (id, name, public)
VALUES ('planos-generales', 'planos-generales', true)
ON CONFLICT (id) DO NOTHING;

-- Extrae el congregacion_id del nombre de archivo: "imagenes/{congregacion_id}_plano.ext"
CREATE OR REPLACE FUNCTION public.storage_plano_general_congregacion_id(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT NULLIF(split_part(split_part(_name, '/', 2), '_', 1), '')::uuid;
$function$;

CREATE POLICY "Planos generales: ver solo de la propia congregación"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'planos-generales'
  AND public.user_has_access_to_congregacion(
    public.storage_plano_general_congregacion_id(name)
  )
);

CREATE POLICY "Planos generales: subir solo en la propia congregación"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'planos-generales'
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_plano_general_congregacion_id(name)
  )
);

CREATE POLICY "Planos generales: actualizar solo en la propia congregación"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'planos-generales'
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_plano_general_congregacion_id(name)
  )
)
WITH CHECK (
  bucket_id = 'planos-generales'
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_plano_general_congregacion_id(name)
  )
);

CREATE POLICY "Planos generales: eliminar solo en la propia congregación"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'planos-generales'
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_plano_general_congregacion_id(name)
  )
);
