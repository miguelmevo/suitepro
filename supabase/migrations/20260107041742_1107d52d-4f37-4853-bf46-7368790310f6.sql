-- Recrear la función con SECURITY DEFINER para que pueda insertar en usuarios_congregacion
-- sin ser bloqueado por RLS durante la creación de congregación
CREATE OR REPLACE FUNCTION public.assign_congregation_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertar al usuario actual como admin de la nueva congregación
  -- Esta función se ejecuta con privilegios elevados para bypass RLS
  INSERT INTO public.usuarios_congregacion (user_id, congregacion_id, rol, es_principal, activo)
  VALUES (auth.uid(), NEW.id, 'admin', true, true);
  
  RETURN NEW;
END;
$$;