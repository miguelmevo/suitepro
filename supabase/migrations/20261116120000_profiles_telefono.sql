-- Celular (+56XXXXXXXXX) que la persona indica al registrarse.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefono text;
