-- Actualizar políticas RLS para permitir que cualquier usuario autenticado pueda crear congregaciones
-- y automáticamente convertirse en admin de esa congregación

-- Eliminar política existente que solo permite a superadmin crear
DROP POLICY IF EXISTS "Solo superadmin puede crear congregaciones" ON public.congregaciones;

-- Crear nueva política que permite a cualquier usuario autenticado crear congregaciones
CREATE POLICY "Usuarios autenticados pueden crear congregaciones"
ON public.congregaciones
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Crear función para asignar automáticamente al creador como admin de la congregación
CREATE OR REPLACE FUNCTION public.assign_congregation_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Insertar al usuario actual como admin de la nueva congregación
  INSERT INTO public.usuarios_congregacion (user_id, congregacion_id, rol, es_principal, activo)
  VALUES (auth.uid(), NEW.id, 'admin', true, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger que se ejecuta después de insertar una nueva congregación
DROP TRIGGER IF EXISTS on_congregation_created ON public.congregaciones;
CREATE TRIGGER on_congregation_created
AFTER INSERT ON public.congregaciones
FOR EACH ROW
EXECUTE FUNCTION public.assign_congregation_admin();

-- Actualizar política de actualización para permitir que admins de la congregación puedan actualizarla
DROP POLICY IF EXISTS "Solo superadmin puede actualizar congregaciones" ON public.congregaciones;
CREATE POLICY "Admin de congregación puede actualizar su congregación"
ON public.congregaciones
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
    AND uc.congregacion_id = congregaciones.id
    AND uc.rol = 'admin'
    AND uc.activo = true
  )
  OR has_role(auth.uid(), 'admin')
);

-- Actualizar política de eliminación para permitir que admins de la congregación puedan eliminarla
DROP POLICY IF EXISTS "Solo superadmin puede eliminar congregaciones" ON public.congregaciones;
CREATE POLICY "Admin de congregación puede eliminar su congregación"
ON public.congregaciones
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
    AND uc.congregacion_id = congregaciones.id
    AND uc.rol = 'admin'
    AND uc.activo = true
  )
  OR has_role(auth.uid(), 'admin')
);