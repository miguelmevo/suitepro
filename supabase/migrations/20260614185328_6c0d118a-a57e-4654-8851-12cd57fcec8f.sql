
CREATE OR REPLACE FUNCTION public.prevent_super_admin_as_participante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND public.is_super_admin(NEW.user_id) THEN
    RAISE EXCEPTION 'Un usuario super_admin no puede ser vinculado a un participante.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_as_participante ON public.participantes;
CREATE TRIGGER trg_prevent_super_admin_as_participante
  BEFORE INSERT OR UPDATE OF user_id ON public.participantes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_super_admin_as_participante();

CREATE OR REPLACE FUNCTION public.prevent_super_admin_membership_with_participante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.participante_id IS NOT NULL AND public.is_super_admin(NEW.user_id) THEN
    RAISE EXCEPTION 'Un usuario super_admin no puede tener un participante asociado en una congregación.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_membership_with_participante ON public.usuarios_congregacion;
CREATE TRIGGER trg_prevent_super_admin_membership_with_participante
  BEFORE INSERT OR UPDATE OF participante_id, user_id ON public.usuarios_congregacion
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_super_admin_membership_with_participante();
