-- Cónyuge real del participante (para que la IA/rotación puedan verificar un
-- emparejamiento familiar real, en vez de adivinar solo por es_casado/tiene_hijos).
-- Null = no seleccionado o "No aplica" (cónyuge no está en la congregación).
ALTER TABLE public.participantes
  ADD COLUMN IF NOT EXISTS conyuge_id uuid REFERENCES public.participantes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_participantes_conyuge_id ON public.participantes (conyuge_id);

-- Exponer conyuge_id en la función segura que ya usa el frontend.
-- Postgres no permite cambiar el tipo de retorno (columnas de RETURNS TABLE) con
-- CREATE OR REPLACE; hay que dropearla primero.
DROP FUNCTION IF EXISTS public.get_participantes_seguros(uuid);
CREATE FUNCTION public.get_participantes_seguros(_congregacion_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, nombre text, apellido text, telefono text, estado_aprobado boolean, responsabilidad text[], responsabilidad_adicional text, grupo_predicacion_id uuid, restriccion_disponibilidad text, es_capitan_grupo boolean, es_publicador_inactivo boolean, activo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, genero text, es_casado boolean, tiene_hijos boolean, inscrito_emc boolean, alias text, conyuge_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.nombre, p.apellido,
    CASE
      WHEN public.has_permission(auth.uid(), p.congregacion_id, 'configuracion_participantes', 'ver') THEN p.telefono
      ELSE NULL
    END as telefono,
    p.estado_aprobado, p.responsabilidad, p.responsabilidad_adicional, p.grupo_predicacion_id,
    p.restriccion_disponibilidad, p.es_capitan_grupo, p.es_publicador_inactivo,
    p.activo, p.created_at, p.updated_at, p.user_id, p.genero,
    p.es_casado, p.tiene_hijos, p.inscrito_emc, p.alias, p.conyuge_id
  FROM public.participantes p
  WHERE p.congregacion_id = COALESCE(_congregacion_id, get_user_congregacion_id())
$function$;

-- Mantener el vínculo bidireccional (si A dice que B es su cónyuge, B también
-- debe apuntar a A), sin importar desde qué pantalla se edite.
CREATE OR REPLACE FUNCTION public.sync_conyuge_bidireccional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si cambió el cónyuge, limpiar el vínculo inverso anterior (si correspondía a este registro)
  IF TG_OP = 'UPDATE' AND OLD.conyuge_id IS DISTINCT FROM NEW.conyuge_id THEN
    IF OLD.conyuge_id IS NOT NULL THEN
      UPDATE public.participantes
      SET conyuge_id = NULL
      WHERE id = OLD.conyuge_id AND conyuge_id = OLD.id;
    END IF;
  END IF;

  -- Establecer el vínculo inverso del nuevo cónyuge (guard evita recursión infinita)
  IF NEW.conyuge_id IS NOT NULL THEN
    UPDATE public.participantes
    SET conyuge_id = NEW.id
    WHERE id = NEW.conyuge_id AND conyuge_id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conyuge_bidireccional ON public.participantes;
CREATE TRIGGER trg_sync_conyuge_bidireccional
AFTER INSERT OR UPDATE OF conyuge_id ON public.participantes
FOR EACH ROW
EXECUTE FUNCTION public.sync_conyuge_bidireccional();
