-- Registro de comunicaciones masivas enviadas por correo (una por usuario y clave),
-- para no enviar dos veces el mismo aviso. Solo lo usa el servicio (sin políticas = sin acceso desde el cliente).
CREATE TABLE IF NOT EXISTS public.comunicaciones_enviadas (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clave text NOT NULL,
  enviado_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, clave)
);
ALTER TABLE public.comunicaciones_enviadas ENABLE ROW LEVEL SECURITY;
