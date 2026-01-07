-- Función para asignar usuario a congregación existente (durante registro con slug)
CREATE OR REPLACE FUNCTION public.assign_user_to_congregation(_congregacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verificar que la congregación existe y está activa
  IF NOT EXISTS (
    SELECT 1 FROM public.congregaciones 
    WHERE id = _congregacion_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'congregation_not_found';
  END IF;

  -- Verificar que el usuario no tenga ya una membresía en esta congregación
  IF EXISTS (
    SELECT 1 FROM public.usuarios_congregacion 
    WHERE user_id = auth.uid() AND congregacion_id = _congregacion_id
  ) THEN
    -- Ya existe, no hacer nada
    RETURN;
  END IF;

  -- Insertar la membresía (como usuario pendiente de aprobación)
  INSERT INTO public.usuarios_congregacion (user_id, congregacion_id, rol, es_principal, activo)
  VALUES (auth.uid(), _congregacion_id, 'user', true, true);
END;
$$;