-- Suscripciones de Web Push (navegador Chrome/Edge/Firefox/Safari), en
-- paralelo a device_tokens (que es para la app nativa vía Capacitor+FCM).
CREATE TABLE public.web_push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_web_push_subscriptions_user ON public.web_push_subscriptions(user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias suscripciones web push"
ON public.web_push_subscriptions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Usuarios crean sus propias suscripciones web push"
ON public.web_push_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuarios eliminan sus propias suscripciones web push"
ON public.web_push_subscriptions
FOR DELETE
USING (user_id = auth.uid());
