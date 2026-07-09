-- Eliminar políticas existentes del bucket para recrearlas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver PDFs de programas" ON storage.objects;
DROP POLICY IF EXISTS "Admin y Editor pueden subir PDFs de programas" ON storage.objects;
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar PDFs de programas" ON storage.objects;
DROP POLICY IF EXISTS "Admin y Editor pueden eliminar PDFs de programas" ON storage.objects;

-- Recrear políticas para usuarios autenticados en el bucket
CREATE POLICY "Usuarios autenticados pueden ver PDFs de programas"
ON storage.objects
FOR SELECT
USING (bucket_id = 'programas-pdf' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admin y Editor pueden subir PDFs de programas"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'programas-pdf' AND is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden actualizar PDFs de programas"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'programas-pdf' AND is_admin_or_editor(auth.uid()));

CREATE POLICY "Admin y Editor pueden eliminar PDFs de programas"
ON storage.objects
FOR DELETE
USING (bucket_id = 'programas-pdf' AND is_admin_or_editor(auth.uid()));