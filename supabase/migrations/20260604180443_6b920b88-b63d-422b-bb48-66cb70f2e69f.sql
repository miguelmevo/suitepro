
-- Add bloqueado column to ciclos_territorio
ALTER TABLE public.ciclos_territorio
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;

-- RPC: delete a completed cycle (and its manzanas_trabajadas). Locked cycles can only be deleted by super_admin.
CREATE OR REPLACE FUNCTION public.eliminar_ciclo_territorio(_ciclo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _congregacion_id uuid;
  _bloqueado boolean;
BEGIN
  SELECT congregacion_id, bloqueado
    INTO _congregacion_id, _bloqueado
  FROM ciclos_territorio
  WHERE id = _ciclo_id;

  IF _congregacion_id IS NULL THEN
    RAISE EXCEPTION 'cycle_not_found';
  END IF;

  -- Locked cycles: only super_admin can delete
  IF _bloqueado AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'cycle_locked';
  END IF;

  -- Unlocked: admin/editor of the congregation, or super_admin
  IF NOT _bloqueado AND NOT is_admin_or_editor_in_congregacion(_congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM manzanas_trabajadas WHERE ciclo_id = _ciclo_id;
  DELETE FROM ciclos_territorio WHERE id = _ciclo_id;
END;
$$;

-- RPC: toggle bloqueado flag. Only super_admin can change the lock state.
CREATE OR REPLACE FUNCTION public.toggle_bloqueo_ciclo(_ciclo_id uuid, _bloqueado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    -- Also allow admin of the congregation to lock/unlock
    IF NOT EXISTS (
      SELECT 1 FROM ciclos_territorio ct
      WHERE ct.id = _ciclo_id
        AND is_admin_or_editor_in_congregacion(ct.congregacion_id)
    ) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
  END IF;

  UPDATE ciclos_territorio
  SET bloqueado = _bloqueado
  WHERE id = _ciclo_id;
END;
$$;
