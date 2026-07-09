
-- 1) Backfill: si participantes.user_id apunta a un usuario sin participante_id, sincronizar.
UPDATE public.usuarios_congregacion uc
SET participante_id = p.id
FROM public.participantes p
WHERE p.user_id = uc.user_id
  AND p.congregacion_id = uc.congregacion_id
  AND uc.participante_id IS DISTINCT FROM p.id;

-- 2) Backfill inverso: si usuarios_congregacion.participante_id apunta a un participante sin user_id, sincronizar.
UPDATE public.participantes p
SET user_id = uc.user_id
FROM public.usuarios_congregacion uc
WHERE uc.participante_id = p.id
  AND uc.congregacion_id = p.congregacion_id
  AND p.user_id IS DISTINCT FROM uc.user_id;

-- 3) Trigger: cuando cambia participantes.user_id, sincronizar usuarios_congregacion.participante_id.
CREATE OR REPLACE FUNCTION public.sync_participante_to_usuario_congregacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Evitar recursión cuando el cambio viene del otro trigger
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Quitar el participante anterior de cualquier usuario que lo tuviese asignado en la misma congregacion
  IF TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    UPDATE public.usuarios_congregacion
       SET participante_id = NULL
     WHERE user_id = OLD.user_id
       AND congregacion_id = OLD.congregacion_id
       AND participante_id = OLD.id;
  END IF;

  -- Vincular en el nuevo usuario
  IF NEW.user_id IS NOT NULL THEN
    -- Liberar este participante de cualquier otro usuario en la misma congregacion
    UPDATE public.usuarios_congregacion
       SET participante_id = NULL
     WHERE congregacion_id = NEW.congregacion_id
       AND participante_id = NEW.id
       AND user_id <> NEW.user_id;

    UPDATE public.usuarios_congregacion
       SET participante_id = NEW.id
     WHERE user_id = NEW.user_id
       AND congregacion_id = NEW.congregacion_id
       AND participante_id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_participante_to_uc ON public.participantes;
CREATE TRIGGER trg_sync_participante_to_uc
AFTER INSERT OR UPDATE OF user_id ON public.participantes
FOR EACH ROW
EXECUTE FUNCTION public.sync_participante_to_usuario_congregacion();

-- 4) Trigger: cuando cambia usuarios_congregacion.participante_id, sincronizar participantes.user_id.
CREATE OR REPLACE FUNCTION public.sync_usuario_congregacion_to_participante()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Si se desasigna o se cambia el participante, limpiar el anterior
  IF TG_OP = 'UPDATE' AND OLD.participante_id IS NOT NULL
     AND OLD.participante_id IS DISTINCT FROM NEW.participante_id THEN
    UPDATE public.participantes
       SET user_id = NULL
     WHERE id = OLD.participante_id
       AND user_id = OLD.user_id;
  END IF;

  -- Vincular en el nuevo participante
  IF NEW.participante_id IS NOT NULL THEN
    -- Quitar este user_id de cualquier otro participante
    UPDATE public.participantes
       SET user_id = NULL
     WHERE congregacion_id = NEW.congregacion_id
       AND user_id = NEW.user_id
       AND id <> NEW.participante_id;

    UPDATE public.participantes
       SET user_id = NEW.user_id
     WHERE id = NEW.participante_id
       AND user_id IS DISTINCT FROM NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_uc_to_participante ON public.usuarios_congregacion;
CREATE TRIGGER trg_sync_uc_to_participante
AFTER INSERT OR UPDATE OF participante_id ON public.usuarios_congregacion
FOR EACH ROW
EXECUTE FUNCTION public.sync_usuario_congregacion_to_participante();
