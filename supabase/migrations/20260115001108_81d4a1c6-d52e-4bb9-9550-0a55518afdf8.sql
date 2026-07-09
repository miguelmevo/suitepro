-- Tabla para historial de sesiones (últimos accesos)
CREATE TABLE public.historial_sesiones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  congregacion_id UUID REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre_completo TEXT,
  fecha_login TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- Tabla para presencia en tiempo real
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  congregacion_id UUID REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre_completo TEXT,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT true,
  current_page TEXT
);

-- Enable RLS
ALTER TABLE public.historial_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Políticas para historial_sesiones (solo admins de la congregación pueden ver)
CREATE POLICY "Admins can view session history" 
ON public.historial_sesiones 
FOR SELECT 
USING (
  is_admin_or_editor_in_congregacion(congregacion_id) OR
  is_super_admin(auth.uid())
);

CREATE POLICY "Authenticated users can insert own sessions" 
ON public.historial_sesiones 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Políticas para user_presence
CREATE POLICY "Admins can view presence" 
ON public.user_presence 
FOR SELECT 
USING (
  is_admin_or_editor_in_congregacion(congregacion_id) OR
  is_super_admin(auth.uid())
);

CREATE POLICY "Users can manage own presence" 
ON public.user_presence 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Índices para mejor rendimiento
CREATE INDEX idx_historial_sesiones_congregacion ON public.historial_sesiones(congregacion_id);
CREATE INDEX idx_historial_sesiones_fecha ON public.historial_sesiones(fecha_login DESC);
CREATE INDEX idx_user_presence_congregacion ON public.user_presence(congregacion_id);
CREATE INDEX idx_user_presence_online ON public.user_presence(is_online, last_seen);