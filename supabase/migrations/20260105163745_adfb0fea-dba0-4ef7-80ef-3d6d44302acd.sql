-- =============================================
-- FASE 1: TABLAS BASE PARA MULTI-CONGREGACIÓN
-- =============================================

-- 1.1 Crear tabla congregaciones
CREATE TABLE public.congregaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- para subdominios/paths: "villarreal" → villarreal.app.com
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_congregaciones_updated_at
BEFORE UPDATE ON public.congregaciones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.congregaciones ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para congregaciones
CREATE POLICY "Usuarios autenticados pueden ver congregaciones activas"
ON public.congregaciones
FOR SELECT
USING (auth.uid() IS NOT NULL AND activo = true);

CREATE POLICY "Solo superadmin puede crear congregaciones"
ON public.congregaciones
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo superadmin puede actualizar congregaciones"
ON public.congregaciones
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo superadmin puede eliminar congregaciones"
ON public.congregaciones
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 1.2 Crear tabla usuarios_congregacion (relación N:N con roles por congregación)
CREATE TABLE public.usuarios_congregacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  congregacion_id UUID NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  rol app_role NOT NULL DEFAULT 'user',
  es_principal BOOLEAN NOT NULL DEFAULT false, -- congregación por defecto del usuario
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, congregacion_id)
);

-- Habilitar RLS
ALTER TABLE public.usuarios_congregacion ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para usuarios_congregacion
CREATE POLICY "Usuarios pueden ver sus propias membresías"
ON public.usuarios_congregacion
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admin puede ver todas las membresías de su congregación"
ON public.usuarios_congregacion
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = usuarios_congregacion.congregacion_id
      AND uc.rol = 'admin'
      AND uc.activo = true
  )
);

CREATE POLICY "Admin puede crear membresías en su congregación"
ON public.usuarios_congregacion
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = usuarios_congregacion.congregacion_id
      AND uc.rol = 'admin'
      AND uc.activo = true
  )
);

CREATE POLICY "Admin puede actualizar membresías en su congregación"
ON public.usuarios_congregacion
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = usuarios_congregacion.congregacion_id
      AND uc.rol = 'admin'
      AND uc.activo = true
  )
);

CREATE POLICY "Admin puede eliminar membresías en su congregación"
ON public.usuarios_congregacion
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = usuarios_congregacion.congregacion_id
      AND uc.rol = 'admin'
      AND uc.activo = true
  )
);

-- 1.3 Funciones helper para multi-congregación

-- Obtener la congregación principal del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_congregacion_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT congregacion_id 
  FROM usuarios_congregacion 
  WHERE user_id = auth.uid() 
    AND es_principal = true 
    AND activo = true
  LIMIT 1
$$;

-- Verificar si el usuario tiene acceso a una congregación
CREATE OR REPLACE FUNCTION public.user_has_access_to_congregacion(_congregacion_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion 
    WHERE user_id = auth.uid() 
      AND congregacion_id = _congregacion_id 
      AND activo = true
  )
$$;

-- Verificar si el usuario tiene un rol específico en una congregación
CREATE OR REPLACE FUNCTION public.has_role_in_congregacion(_congregacion_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion 
    WHERE user_id = auth.uid() 
      AND congregacion_id = _congregacion_id 
      AND rol = _role
      AND activo = true
  )
$$;

-- Verificar si el usuario es admin o editor en una congregación
CREATE OR REPLACE FUNCTION public.is_admin_or_editor_in_congregacion(_congregacion_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion 
    WHERE user_id = auth.uid() 
      AND congregacion_id = _congregacion_id 
      AND rol IN ('admin', 'editor')
      AND activo = true
  )
$$;