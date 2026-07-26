-- Igual que programas_publicados, las políticas de storage del bucket
-- "programas-pdf" (donde se sube el PDF antes de insertar la fila) usaban
-- solo is_admin_or_editor_in_congregacion (rol legado), bloqueando la subida
-- del archivo aunque el usuario ya tuviera permiso granular para publicar el
-- programa. El path de cada archivo es
-- "<congregacion_id>/<tipo_programa>/<periodo>_<timestamp>.pdf", así que se
-- puede extraer el tipo de programa para reusar can_publicar_programa.
CREATE OR REPLACE FUNCTION public.storage_programa_tipo(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(split_part(_name, '/', 2), '')
$$;

DROP POLICY IF EXISTS "Programas PDF: subir solo en la propia congregación" ON storage.objects;
CREATE POLICY "Programas PDF: subir solo en la propia congregación"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'programas-pdf'
  AND (
    public.is_admin_or_editor_in_congregacion(public.storage_programa_congregacion_id(name))
    OR public.can_publicar_programa(public.storage_programa_congregacion_id(name), public.storage_programa_tipo(name))
  )
);

DROP POLICY IF EXISTS "Programas PDF: actualizar solo en la propia congregación" ON storage.objects;
CREATE POLICY "Programas PDF: actualizar solo en la propia congregación"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'programas-pdf'
  AND (
    public.is_admin_or_editor_in_congregacion(public.storage_programa_congregacion_id(name))
    OR public.can_publicar_programa(public.storage_programa_congregacion_id(name), public.storage_programa_tipo(name))
  )
)
WITH CHECK (
  bucket_id = 'programas-pdf'
  AND (
    public.is_admin_or_editor_in_congregacion(public.storage_programa_congregacion_id(name))
    OR public.can_publicar_programa(public.storage_programa_congregacion_id(name), public.storage_programa_tipo(name))
  )
);

DROP POLICY IF EXISTS "Programas PDF: eliminar solo en la propia congregación" ON storage.objects;
CREATE POLICY "Programas PDF: eliminar solo en la propia congregación"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'programas-pdf'
  AND (
    public.is_admin_or_editor_in_congregacion(public.storage_programa_congregacion_id(name))
    OR public.can_publicar_programa(public.storage_programa_congregacion_id(name), public.storage_programa_tipo(name))
  )
);
