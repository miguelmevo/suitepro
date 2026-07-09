
-- =========================================================
-- 1) BUCKET territorios: aislamiento por congregación
-- =========================================================

-- Eliminar políticas abiertas existentes
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver imágenes de territorios" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir imágenes" ON storage.objects;

-- Función auxiliar: extrae el prefijo congregacion_id del nombre de archivo
-- Formato esperado: imagenes/{congregacion_id}_TERR{numero}.ext
CREATE OR REPLACE FUNCTION public.storage_territorio_congregacion_id(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(split_part(split_part(_name, '/', 2), '_', 1), '')::uuid;
$$;

-- SELECT: solo miembros de la congregación dueña del archivo
CREATE POLICY "Territorios: ver solo imágenes de la propia congregación"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'territorios'
  AND public.user_has_access_to_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
);

-- INSERT: solo admin/editor de la congregación dueña
CREATE POLICY "Territorios: subir solo en la propia congregación"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'territorios'
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
);

-- UPDATE: solo admin/editor de la congregación dueña
CREATE POLICY "Territorios: actualizar solo en la propia congregación"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'territorios'
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
)
WITH CHECK (
  bucket_id = 'territorios'
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
);

-- DELETE: solo admin/editor de la congregación dueña
CREATE POLICY "Territorios: eliminar solo en la propia congregación"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'territorios'
  AND public.is_admin_or_editor_in_congregacion(
    public.storage_territorio_congregacion_id(name)
  )
);

-- =========================================================
-- 2) REALTIME: requerir autenticación para suscribirse
-- =========================================================

ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;

CREATE POLICY "Authenticated can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
