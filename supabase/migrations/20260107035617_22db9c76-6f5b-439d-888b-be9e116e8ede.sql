-- Eliminar política que expone datos a anónimos
DROP POLICY IF EXISTS "Anon can verify slug exists" ON public.congregaciones;

-- Crear función RPC segura que solo devuelve datos mínimos para validar slug en /auth
CREATE OR REPLACE FUNCTION public.get_congregacion_by_slug(_slug text)
RETURNS TABLE (id uuid, nombre text, slug text, activo boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.nombre, c.slug, c.activo
  FROM public.congregaciones c
  WHERE c.slug = _slug
    AND c.activo = true
  LIMIT 1;
$$;

-- Permitir que usuarios anónimos y autenticados llamen esta función
GRANT EXECUTE ON FUNCTION public.get_congregacion_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_congregacion_by_slug(text) TO authenticated;
