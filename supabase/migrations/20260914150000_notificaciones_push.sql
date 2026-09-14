-- Preferencias de notificaciones push por usuario y categoría.
-- Categorías: predicacion, vida_ministerio, servicio, eventos.
-- Por defecto todas activas; el usuario las desactiva desde Mi Cuenta.
CREATE TABLE public.notificacion_preferencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('predicacion', 'vida_ministerio', 'servicio', 'eventos')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, categoria)
);

ALTER TABLE public.notificacion_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias preferencias de notificación"
ON public.notificacion_preferencias
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Usuarios crean sus propias preferencias de notificación"
ON public.notificacion_preferencias
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuarios actualizan sus propias preferencias de notificación"
ON public.notificacion_preferencias
FOR UPDATE
USING (user_id = auth.uid());

CREATE TRIGGER update_notificacion_preferencias_updated_at
BEFORE UPDATE ON public.notificacion_preferencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tokens de dispositivo (app nativa vía Capacitor + Firebase Cloud Messaging).
-- Un usuario puede tener varios dispositivos; un mismo token se reasigna si
-- cambia de usuario (reinstalación, otro usuario en el mismo dispositivo).
CREATE TABLE public.device_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('ios', 'android')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens(user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propios device tokens"
ON public.device_tokens
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Usuarios registran sus propios device tokens"
ON public.device_tokens
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuarios actualizan sus propios device tokens"
ON public.device_tokens
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Usuarios eliminan sus propios device tokens"
ON public.device_tokens
FOR DELETE
USING (user_id = auth.uid());

CREATE TRIGGER update_device_tokens_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
