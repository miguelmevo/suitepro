-- Comité de servicio: Superintendente de Servicio (SS), Coordinador (CO) y Secretario (SEC).
-- Un cargo por anciano y un solo titular de cada cargo por congregación.

ALTER TABLE public.participantes
  ADD COLUMN IF NOT EXISTS cargo_comite text
  CHECK (cargo_comite IN ('sup_servicio', 'coordinador', 'secretario'));

CREATE UNIQUE INDEX IF NOT EXISTS participantes_cargo_comite_unico
  ON public.participantes (congregacion_id, cargo_comite)
  WHERE cargo_comite IS NOT NULL;

-- Si el titular deja de ser anciano o queda inactivo, el cargo se libera solo.
CREATE OR REPLACE FUNCTION public.trg_participante_cargo_comite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cargo_comite IS NOT NULL AND (
       NOT COALESCE('anciano' = ANY (NEW.responsabilidad), false)
       OR NOT COALESCE(NEW.activo, false)
       OR COALESCE(NEW.es_publicador_inactivo, false)
     ) THEN
    NEW.cargo_comite := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS participante_cargo_comite ON public.participantes;
CREATE TRIGGER participante_cargo_comite
  BEFORE INSERT OR UPDATE ON public.participantes
  FOR EACH ROW EXECUTE FUNCTION public.trg_participante_cargo_comite();

-- La lectura segura de participantes devuelve también el cargo (cambia el tipo de retorno).
DROP FUNCTION IF EXISTS public.get_participantes_seguros(uuid);
CREATE FUNCTION public.get_participantes_seguros(_congregacion_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, nombre text, apellido text, telefono text, estado_aprobado boolean, responsabilidad text[], responsabilidad_adicional text, grupo_predicacion_id uuid, restriccion_disponibilidad text, es_capitan_grupo boolean, es_publicador_inactivo boolean, activo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, genero text, es_casado boolean, tiene_hijos boolean, inscrito_emc boolean, alias text, conyuge_id uuid, cargo_comite text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.nombre, p.apellido,
    CASE
      WHEN public.has_permission(auth.uid(), p.congregacion_id, 'configuracion_participantes', 'ver') THEN p.telefono
      ELSE NULL
    END as telefono,
    p.estado_aprobado, p.responsabilidad, p.responsabilidad_adicional, p.grupo_predicacion_id,
    p.restriccion_disponibilidad, p.es_capitan_grupo, p.es_publicador_inactivo,
    p.activo, p.created_at, p.updated_at, p.user_id, p.genero,
    p.es_casado, p.tiene_hijos, p.inscrito_emc, p.alias, p.conyuge_id, p.cargo_comite
  FROM public.participantes p
  WHERE p.congregacion_id = COALESCE(_congregacion_id, get_user_congregacion_id())
$$;
GRANT EXECUTE ON FUNCTION public.get_participantes_seguros(uuid) TO anon, authenticated, service_role;
