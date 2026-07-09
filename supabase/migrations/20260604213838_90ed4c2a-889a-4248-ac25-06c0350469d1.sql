
-- 1) Generator function for short public codes (8 chars, no ambiguous: 0,O,1,I,L)
CREATE OR REPLACE FUNCTION public.generate_codigo_publico()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.congregaciones WHERE codigo_publico = code) THEN
      RETURN code;
    END IF;
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'could_not_generate_unique_code';
    END IF;
  END LOOP;
END;
$$;

-- 2) Add column
ALTER TABLE public.congregaciones
  ADD COLUMN IF NOT EXISTS codigo_publico text UNIQUE;

-- 3) Backfill existing rows
UPDATE public.congregaciones
SET codigo_publico = public.generate_codigo_publico()
WHERE codigo_publico IS NULL;

-- 4) Make NOT NULL with default for new rows
ALTER TABLE public.congregaciones
  ALTER COLUMN codigo_publico SET DEFAULT public.generate_codigo_publico(),
  ALTER COLUMN codigo_publico SET NOT NULL;

-- 5) Lookup function by public code (replaces slug lookup for public access)
CREATE OR REPLACE FUNCTION public.get_congregacion_by_codigo(_codigo text)
RETURNS TABLE(id uuid, nombre text, slug text, codigo_publico text, color_primario text, activo boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.nombre, c.slug, c.codigo_publico, c.color_primario, c.activo
  FROM public.congregaciones c
  WHERE c.codigo_publico = _codigo
    AND c.activo = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_congregacion_by_codigo(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_codigo_publico() TO authenticated, service_role;
