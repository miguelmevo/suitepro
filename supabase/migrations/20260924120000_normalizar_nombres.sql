-- Nombre y apellido sin espacios de más: se recortan los de los bordes y se
-- colapsan los dobles. Un espacio al final del apellido dejaba la coma entre
-- dos espacios en las listas ("Mercado , Juan Carlos"). Se hace en la base para
-- cubrir cualquier vía de entrada (formularios, registro, edge functions).

CREATE OR REPLACE FUNCTION public.normalizar_nombre_apellido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.nombre := btrim(regexp_replace(NEW.nombre, '\s+', ' ', 'g'));
  NEW.apellido := btrim(regexp_replace(NEW.apellido, '\s+', ' ', 'g'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_nombre_profiles ON public.profiles;
CREATE TRIGGER trg_normalizar_nombre_profiles
BEFORE INSERT OR UPDATE OF nombre, apellido ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalizar_nombre_apellido();

DROP TRIGGER IF EXISTS trg_normalizar_nombre_participantes ON public.participantes;
CREATE TRIGGER trg_normalizar_nombre_participantes
BEFORE INSERT OR UPDATE OF nombre, apellido ON public.participantes
FOR EACH ROW EXECUTE FUNCTION public.normalizar_nombre_apellido();

-- Limpieza de los registros que ya tienen espacios de más (dispara el trigger).
UPDATE public.profiles
SET nombre = nombre, apellido = apellido
WHERE nombre IS DISTINCT FROM btrim(regexp_replace(nombre, '\s+', ' ', 'g'))
   OR apellido IS DISTINCT FROM btrim(regexp_replace(apellido, '\s+', ' ', 'g'));

UPDATE public.participantes
SET nombre = nombre, apellido = apellido
WHERE nombre IS DISTINCT FROM btrim(regexp_replace(nombre, '\s+', ' ', 'g'))
   OR apellido IS DISTINCT FROM btrim(regexp_replace(apellido, '\s+', ' ', 'g'));
