
-- Helper: extract congregation id from programas-pdf object name (first path segment)
CREATE OR REPLACE FUNCTION public.storage_programa_congregacion_id(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(split_part(_name, '/', 1), '')::uuid
$$;

DROP POLICY IF EXISTS "Admin y Editor pueden subir PDFs de programas" ON storage.objects;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar PDFs de programas" ON storage.objects;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar PDFs de programas" ON storage.objects;

CREATE POLICY "Programas PDF: subir solo en la propia congregación"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'programas-pdf'
  AND public.is_admin_or_editor_in_congregacion(public.storage_programa_congregacion_id(name))
);

CREATE POLICY "Programas PDF: actualizar solo en la propia congregación"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'programas-pdf'
  AND public.is_admin_or_editor_in_congregacion(public.storage_programa_congregacion_id(name))
)
WITH CHECK (
  bucket_id = 'programas-pdf'
  AND public.is_admin_or_editor_in_congregacion(public.storage_programa_congregacion_id(name))
);

CREATE POLICY "Programas PDF: eliminar solo en la propia congregación"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'programas-pdf'
  AND public.is_admin_or_editor_in_congregacion(public.storage_programa_congregacion_id(name))
);
