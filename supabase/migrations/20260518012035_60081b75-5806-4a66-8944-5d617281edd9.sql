ALTER TABLE public.dias_especiales
ADD COLUMN IF NOT EXISTS bloquea_reuniones text[] NOT NULL DEFAULT '{}'::text[];